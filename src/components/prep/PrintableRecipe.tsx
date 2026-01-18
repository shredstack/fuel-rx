'use client'

import { useRef } from 'react'
import type { PrepTaskWithSession, ConsolidatedMeal } from './prepUtils'
import { formatCookingTemps, formatCookingTimes, formatDayRange } from './prepUtils'

interface PrintableRecipeProps {
  meal: ConsolidatedMeal
  task: PrepTaskWithSession
  onClose: () => void
}

export default function PrintableRecipe({ meal, task, onClose }: PrintableRecipeProps) {
  const printRef = useRef<HTMLDivElement>(null)

  const cookingTemps = formatCookingTemps(task.cooking_temps)
  const cookingTimes = formatCookingTimes(task.cooking_times)

  const handlePrint = () => {
    const printContent = printRef.current
    if (!printContent) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${meal.mealName} - FuelRx Recipe</title>
          <style>
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.5;
              padding: 24px;
              max-width: 800px;
              margin: 0 auto;
              color: #1f2937;
            }
            h1 {
              font-size: 24px;
              margin-bottom: 8px;
              color: #111827;
            }
            .meta {
              color: #6b7280;
              font-size: 14px;
              margin-bottom: 24px;
              display: flex;
              gap: 16px;
              flex-wrap: wrap;
            }
            .meta-item {
              display: flex;
              align-items: center;
              gap: 4px;
            }
            .section {
              margin-bottom: 24px;
            }
            .section-title {
              font-size: 14px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: #374151;
              margin-bottom: 12px;
              padding-bottom: 4px;
              border-bottom: 2px solid #0d9488;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 8px;
            }
            .list-item {
              display: flex;
              align-items: flex-start;
              gap: 8px;
            }
            .bullet {
              color: #0d9488;
              font-weight: bold;
            }
            .step-number {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 24px;
              height: 24px;
              background: #0d9488;
              color: white;
              border-radius: 50%;
              font-size: 12px;
              font-weight: 600;
              flex-shrink: 0;
            }
            .steps {
              list-style: none;
            }
            .step {
              display: flex;
              align-items: flex-start;
              gap: 12px;
              margin-bottom: 12px;
            }
            .step-text {
              flex: 1;
            }
            .info-box {
              padding: 12px;
              border-radius: 6px;
              margin-bottom: 12px;
            }
            .tips-box {
              background: #fef3c7;
              border: 1px solid #fcd34d;
            }
            .storage-box {
              background: #dbeafe;
              border: 1px solid #93c5fd;
            }
            .info-title {
              font-size: 12px;
              font-weight: 600;
              text-transform: uppercase;
              margin-bottom: 4px;
            }
            .tips-title {
              color: #92400e;
            }
            .storage-title {
              color: #1e40af;
            }
            .tips-text {
              color: #92400e;
              font-size: 14px;
            }
            .storage-text {
              color: #1e40af;
              font-size: 14px;
            }
            .footer {
              margin-top: 32px;
              padding-top: 16px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              color: #9ca3af;
              font-size: 12px;
            }
            @media print {
              body {
                padding: 0;
              }
              .no-print {
                display: none !important;
              }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <div class="footer">
            Printed from FuelRx - fuel-rx.shredstack.net
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Print Recipe</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Preview content */}
        <div className="flex-1 overflow-auto p-6">
          <div ref={printRef}>
            {/* Title and meta */}
            <h1>{meal.mealName}</h1>
            <div className="meta">
              {meal.days.length > 0 && (
                <span className="meta-item">{formatDayRange(meal.days)}</span>
              )}
              {task.estimated_minutes && task.estimated_minutes > 0 && (
                <span className="meta-item">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  {task.estimated_minutes} min
                </span>
              )}
              {cookingTemps.map((temp, i) => (
                <span key={i} className="meta-item">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path>
                  </svg>
                  {temp}
                </span>
              ))}
            </div>

            {/* Timing breakdown */}
            {cookingTimes.length > 0 && (
              <div className="section">
                <div className="section-title">Timing</div>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  {cookingTimes.map((time, i) => (
                    <span key={i}>{time}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Equipment */}
            {task.equipment_needed && task.equipment_needed.length > 0 && (
              <div className="section">
                <div className="section-title">Equipment</div>
                <div className="grid">
                  {task.equipment_needed.map((item, i) => (
                    <div key={i} className="list-item">
                      <span className="bullet">•</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ingredients */}
            {task.ingredients_to_prep && task.ingredients_to_prep.length > 0 && (
              <div className="section">
                <div className="section-title">Ingredients</div>
                <div className="grid">
                  {task.ingredients_to_prep.map((item, i) => (
                    <div key={i} className="list-item">
                      <span className="bullet">•</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Method */}
            {task.detailed_steps && task.detailed_steps.length > 0 && (
              <div className="section">
                <div className="section-title">Method</div>
                <ol className="steps">
                  {task.detailed_steps.map((step, i) => (
                    <li key={i} className="step">
                      <span className="step-number">{i + 1}</span>
                      <span className="step-text">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Tips */}
            {task.tips && task.tips.length > 0 && (
              <div className="info-box tips-box">
                <div className="info-title tips-title">Pro Tips</div>
                {task.tips.map((tip, i) => (
                  <p key={i} className="tips-text">{tip}</p>
                ))}
              </div>
            )}

            {/* Storage */}
            {task.storage && (
              <div className="info-box storage-box">
                <div className="info-title storage-title">Storage</div>
                <p className="storage-text">{task.storage}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
