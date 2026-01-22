import Link from 'next/link';

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-xl shadow-md p-8 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Support</h1>
          <p className="text-gray-700 mb-8">
            Need help with FuelRx? We&apos;re here to assist you.
          </p>

          <div className="space-y-6">
            <div className="border-l-4 border-primary-500 pl-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Email Support</h2>
              <p className="text-gray-700">
                For general inquiries and support requests:
              </p>
              <a
                href="mailto:shredstacksarah@gmail.com"
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                shredstacksarah@gmail.com
              </a>
            </div>

            <div className="border-l-4 border-primary-500 pl-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Response Time</h2>
              <p className="text-gray-700">
                We typically respond to support requests within 24-48 hours during business days.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                How long does it take to generate a meal plan?
              </h3>
              <p className="text-gray-700">
                Meal plan generation typically takes 3-5 minutes. Our AI carefully crafts
                each meal based on your preferences, dietary needs, and nutritional goals.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Can I customize my meal plan after it&apos;s generated?
              </h3>
              <p className="text-gray-700">
                Yes! You can swap individual meals, mark favorites, and adjust portions.
                Your grocery list updates automatically.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                How does the Snap-a-Meal feature work?
              </h3>
              <p className="text-gray-700">
                Take a photo of any meal and our AI will analyze it to estimate calories,
                macros, and ingredients. You can save analyzed meals to your personal cookbook.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Is my data secure?
              </h3>
              <p className="text-gray-700">
                Yes, we use industry-standard encryption for all data transmission and storage.
                Your meal photos and personal information are private by default.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                How do I delete my account?
              </h3>
              <p className="text-gray-700">
                You can delete your account from Settings &gt; Profile &gt; Delete Account.
                This will permanently remove all your data.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Legal</h2>
          <div className="flex gap-6">
            <Link
              href="/privacy"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
