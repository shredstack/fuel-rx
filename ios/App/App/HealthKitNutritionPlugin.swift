import Foundation
import Capacitor
import HealthKit

@objc(HealthKitNutritionPlugin)
public class HealthKitNutritionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthKitNutritionPlugin"
    public let jsName = "HealthKitNutrition"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "writeNutritionCorrelation", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteSamples", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readNutritionSamples", returnType: CAPPluginReturnPromise),
    ]

    private let healthStore = HKHealthStore()

    // MARK: - HealthKit Quantity Types for Nutrition

    private let nutritionTypes: [String: HKQuantityType] = {
        var types: [String: HKQuantityType] = [:]
        types["calories"] = HKQuantityType.quantityType(forIdentifier: .dietaryEnergyConsumed)!
        types["protein"] = HKQuantityType.quantityType(forIdentifier: .dietaryProtein)!
        types["carbs"] = HKQuantityType.quantityType(forIdentifier: .dietaryCarbohydrates)!
        types["fat"] = HKQuantityType.quantityType(forIdentifier: .dietaryFatTotal)!
        types["fiber"] = HKQuantityType.quantityType(forIdentifier: .dietaryFiber)!
        return types
    }()

    private let correlationType = HKCorrelationType.correlationType(forIdentifier: .food)!

    // MARK: - Plugin Methods

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
    }

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve([
                "granted": false,
                "permissions": [
                    "calories": false,
                    "protein": false,
                    "carbs": false,
                    "fat": false,
                    "fiber": false,
                ]
            ])
            return
        }

        // Write permissions for individual nutrition quantity types.
        // Note: Do NOT include correlationType — HealthKit derives correlation
        // authorization from the individual sample types automatically.
        var writeTypes = Set<HKSampleType>()
        for type in nutritionTypes.values {
            writeTypes.insert(type)
        }

        // Read permission for calories (duplicate detection)
        let readTypes: Set<HKObjectType> = [
            nutritionTypes["calories"]!
        ]

        healthStore.requestAuthorization(toShare: writeTypes, read: readTypes) { success, error in
            if let error = error {
                call.reject("Authorization failed: \(error.localizedDescription)")
                return
            }

            // Check individual authorization statuses
            var permissions: [String: Bool] = [:]
            for (key, type) in self.nutritionTypes {
                let status = self.healthStore.authorizationStatus(for: type)
                permissions[key] = status == .sharingAuthorized
            }

            call.resolve([
                "granted": success,
                "permissions": permissions,
            ])
        }
    }

    @objc func writeNutritionCorrelation(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("HealthKit not available")
            return
        }

        guard let calories = call.getDouble("calories"),
              let protein = call.getDouble("protein"),
              let carbs = call.getDouble("carbs"),
              let fat = call.getDouble("fat"),
              let startDateStr = call.getString("startDate") else {
            call.reject("Missing required fields: calories, protein, carbs, fat, startDate")
            return
        }

        let fiber = call.getDouble("fiber")
        let mealName = call.getString("mealName") ?? "Meal"
        let fuelrxEntryId = call.getString("fuelrxEntryId") ?? ""

        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let startDate = isoFormatter.date(from: startDateStr) else {
            call.reject("Invalid startDate format. Use ISO 8601.")
            return
        }

        // End date is the same as start for a point-in-time nutrition entry
        let endDate = startDate

        // Build metadata
        let metadata: [String: Any] = [
            HKMetadataKeyFoodType: mealName,
            "FuelRxEntryId": fuelrxEntryId,
        ]

        // Create individual quantity samples
        var samples = Set<HKSample>()
        var sampleIds: [String] = []

        let calSample = HKQuantitySample(
            type: nutritionTypes["calories"]!,
            quantity: HKQuantity(unit: .kilocalorie(), doubleValue: calories),
            start: startDate, end: endDate,
            metadata: metadata
        )
        samples.insert(calSample)

        let proteinSample = HKQuantitySample(
            type: nutritionTypes["protein"]!,
            quantity: HKQuantity(unit: .gram(), doubleValue: protein),
            start: startDate, end: endDate,
            metadata: metadata
        )
        samples.insert(proteinSample)

        let carbsSample = HKQuantitySample(
            type: nutritionTypes["carbs"]!,
            quantity: HKQuantity(unit: .gram(), doubleValue: carbs),
            start: startDate, end: endDate,
            metadata: metadata
        )
        samples.insert(carbsSample)

        let fatSample = HKQuantitySample(
            type: nutritionTypes["fat"]!,
            quantity: HKQuantity(unit: .gram(), doubleValue: fat),
            start: startDate, end: endDate,
            metadata: metadata
        )
        samples.insert(fatSample)

        if let fiberVal = fiber, fiberVal > 0 {
            let fiberSample = HKQuantitySample(
                type: nutritionTypes["fiber"]!,
                quantity: HKQuantity(unit: .gram(), doubleValue: fiberVal),
                start: startDate, end: endDate,
                metadata: metadata
            )
            samples.insert(fiberSample)
        }

        // Create a food correlation grouping all nutrition samples
        let correlation = HKCorrelation(
            type: correlationType,
            start: startDate,
            end: endDate,
            objects: samples,
            metadata: metadata
        )

        healthStore.save(correlation) { success, error in
            if let error = error {
                call.reject("Failed to save nutrition data: \(error.localizedDescription)")
                return
            }

            // Collect UUIDs from all saved samples
            sampleIds.append(correlation.uuid.uuidString)
            for sample in samples {
                sampleIds.append(sample.uuid.uuidString)
            }

            call.resolve([
                "success": true,
                "healthKitSampleIds": sampleIds,
            ])
        }
    }

    @objc func deleteSamples(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("HealthKit not available")
            return
        }

        guard let sampleIds = call.getArray("sampleIds", String.self), !sampleIds.isEmpty else {
            call.reject("Missing or empty sampleIds array")
            return
        }

        let uuids = sampleIds.compactMap { UUID(uuidString: $0) }
        guard !uuids.isEmpty else {
            call.reject("No valid UUIDs provided")
            return
        }

        let predicate = HKQuery.predicateForObjects(with: Set(uuids))

        // Delete correlations first (which contain the samples)
        healthStore.deleteObjects(of: correlationType, predicate: predicate) { success, deletedCount, error in
            // Also try deleting individual samples in case correlation delete missed some
            let group = DispatchGroup()
            var totalDeleted = deletedCount

            for (_, type) in self.nutritionTypes {
                group.enter()
                self.healthStore.deleteObjects(of: type, predicate: predicate) { _, count, _ in
                    totalDeleted += count
                    group.leave()
                }
            }

            group.notify(queue: .main) {
                call.resolve([
                    "success": true,
                    "deletedCount": totalDeleted,
                ])
            }
        }
    }

    @objc func readNutritionSamples(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["samples": []])
            return
        }

        guard let dateStr = call.getString("date") else {
            call.reject("Missing required field: date (YYYY-MM-DD)")
            return
        }

        // Parse date and create day range
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone.current
        guard let dayStart = formatter.date(from: dateStr) else {
            call.reject("Invalid date format. Use YYYY-MM-DD.")
            return
        }
        let dayEnd = Calendar.current.date(byAdding: .day, value: 1, to: dayStart)!

        // Filter by source (our app's bundle ID)
        let sourcePredicate = HKQuery.predicateForObjects(from: HKSource.default())
        let datePredicate = HKQuery.predicateForSamples(withStart: dayStart, end: dayEnd, options: .strictStartDate)
        let compound = NSCompoundPredicate(andPredicateWithSubpredicates: [datePredicate, sourcePredicate])

        let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)

        let query = HKSampleQuery(
            sampleType: correlationType,
            predicate: compound,
            limit: HKObjectQueryNoLimit,
            sortDescriptors: [sortDescriptor]
        ) { _, results, error in
            guard let correlations = results as? [HKCorrelation] else {
                call.resolve(["samples": []])
                return
            }

            let isoFormatter = ISO8601DateFormatter()
            var sampleList: [[String: Any]] = []

            for correlation in correlations {
                var entry: [String: Any] = [
                    "correlationId": correlation.uuid.uuidString,
                    "startDate": isoFormatter.string(from: correlation.startDate),
                    "endDate": isoFormatter.string(from: correlation.endDate),
                    "mealName": correlation.metadata?[HKMetadataKeyFoodType] as? String ?? "",
                    "fuelrxEntryId": correlation.metadata?["FuelRxEntryId"] as? String ?? "",
                ]

                // Extract nutrition values from correlated samples
                var sampleIds: [String] = [correlation.uuid.uuidString]

                for sample in correlation.objects {
                    guard let quantitySample = sample as? HKQuantitySample else { continue }
                    sampleIds.append(quantitySample.uuid.uuidString)

                    if quantitySample.quantityType == self.nutritionTypes["calories"] {
                        entry["calories"] = quantitySample.quantity.doubleValue(for: .kilocalorie())
                    } else if quantitySample.quantityType == self.nutritionTypes["protein"] {
                        entry["protein"] = quantitySample.quantity.doubleValue(for: .gram())
                    } else if quantitySample.quantityType == self.nutritionTypes["carbs"] {
                        entry["carbs"] = quantitySample.quantity.doubleValue(for: .gram())
                    } else if quantitySample.quantityType == self.nutritionTypes["fat"] {
                        entry["fat"] = quantitySample.quantity.doubleValue(for: .gram())
                    } else if quantitySample.quantityType == self.nutritionTypes["fiber"] {
                        entry["fiber"] = quantitySample.quantity.doubleValue(for: .gram())
                    }
                }

                entry["sampleIds"] = sampleIds
                sampleList.append(entry)
            }

            call.resolve(["samples": sampleList])
        }

        healthStore.execute(query)
    }
}
