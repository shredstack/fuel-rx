import { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import MobileTabBar from '@/components/MobileTabBar';

export const metadata: Metadata = {
  title: 'Nutrition Information | FuelRx',
  description: 'Learn about how FuelRx calculates nutrition information and our data sources.',
};

export default function NutritionInfoPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Nutrition Information &amp; Sources
        </h1>

        <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              How We Calculate Nutrition
            </h2>
            <p className="text-gray-600 mb-3">
              FuelRx uses AI to generate personalized meal plans based on your preferences
              and nutritional goals. Our nutrition calculations are based on established
              nutritional databases and guidelines.
            </p>
            <p className="text-gray-600">
              Nutrition values are estimates and may vary based on specific brands,
              preparation methods, and ingredient substitutions you make.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Our Data Sources
            </h2>
            <div className="space-y-4">
              <div className="border-l-4 border-primary-500 pl-4">
                <h3 className="font-medium text-gray-900">
                  USDA Dietary Guidelines for Americans (2020-2025)
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  We reference the latest USDA Dietary Guidelines for macronutrient
                  distribution and daily nutritional targets.
                </p>
                <a
                  href="https://www.dietaryguidelines.gov/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary-600 underline mt-1 inline-block"
                >
                  www.dietaryguidelines.gov
                </a>
              </div>

              <div className="border-l-4 border-primary-500 pl-4">
                <h3 className="font-medium text-gray-900">
                  USDA FoodData Central
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Individual ingredient nutrition data is based on the USDA&apos;s
                  comprehensive food composition database.
                </p>
                <a
                  href="https://fdc.nal.usda.gov/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary-600 underline mt-1 inline-block"
                >
                  fdc.nal.usda.gov
                </a>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Important Disclaimer
            </h2>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                <strong>FuelRx is a meal planning tool, not a medical application.</strong>
              </p>
              <p className="text-sm text-amber-700 mt-2">
                The nutrition information provided is for general informational purposes only
                and should not be considered medical or dietary advice. Always consult with
                a registered dietitian, nutritionist, or healthcare provider before making
                significant changes to your diet, especially if you have medical conditions,
                food allergies, or specific dietary requirements.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Accuracy Limitations
            </h2>
            <ul className="list-disc list-inside text-gray-600 space-y-2 text-sm">
              <li>Nutrition values are estimates based on standard portion sizes</li>
              <li>Actual values may vary by ±10-20% depending on specific ingredients used</li>
              <li>Cooking methods can affect nutritional content</li>
              <li>Brand-specific products may differ from generic database values</li>
              <li>Seasonal variations in produce can affect nutrition content</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Questions?
            </h2>
            <p className="text-gray-600 text-sm">
              If you have questions about our nutrition methodology or need assistance,
              please visit our{' '}
              <a href="/support" className="text-primary-600 underline">
                support page
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      <MobileTabBar />
    </div>
  );
}
