export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-md p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: January 2026</p>

        <div className="prose prose-gray max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
            <p className="text-gray-700 mb-4">
              FuelRx (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy.
              This Privacy Policy explains how we collect, use, disclose, and safeguard your
              information when you use our mobile application and website.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">2. Information We Collect</h2>

            <h3 className="text-lg font-medium text-gray-800 mb-2">Personal Information</h3>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Email address (for account creation and communication)</li>
              <li>Name (optional, for personalization)</li>
              <li>Dietary preferences and restrictions</li>
              <li>Household size and meal preferences</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mb-2">Usage Data</h3>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Meal plans generated and viewed</li>
              <li>Meals logged and tracked</li>
              <li>Photos uploaded for meal analysis</li>
              <li>App usage patterns and preferences</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mb-2">Device Information</h3>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Device type and operating system</li>
              <li>Push notification tokens (if enabled)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Generate personalized meal plans based on your preferences</li>
              <li>Analyze meal photos to provide nutritional information</li>
              <li>Improve our AI algorithms and service quality</li>
              <li>Send notifications about your meal plans (if enabled)</li>
              <li>Provide customer support</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">4. Third-Party Services</h2>
            <p className="text-gray-700 mb-4">We use the following third-party services:</p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li><strong>Supabase:</strong> Database and authentication services</li>
              <li><strong>Anthropic (Claude AI):</strong> AI-powered meal plan generation and photo analysis</li>
              <li><strong>Vercel:</strong> Web hosting and deployment</li>
              <li><strong>Apple Push Notification Service:</strong> Push notifications for iOS</li>
            </ul>
            <p className="text-gray-700">
              These services have their own privacy policies governing their use of your data.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">5. Data Storage and Security</h2>
            <p className="text-gray-700 mb-4">
              Your data is stored securely using industry-standard encryption. We use HTTPS
              for all data transmission and encrypt sensitive data at rest. Your meal photos
              are stored securely and are only accessible to you unless you choose to share them.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">6. Your Rights</h2>
            <p className="text-gray-700 mb-4">You have the right to:</p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Delete your account and associated data</li>
              <li>Export your data</li>
              <li>Opt out of marketing communications</li>
            </ul>
            <p className="text-gray-700">
              To exercise these rights, contact us at support@fuelrx.app.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">7. Children&apos;s Privacy</h2>
            <p className="text-gray-700">
              FuelRx is not intended for children under 13. We do not knowingly collect
              personal information from children under 13.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">8. Changes to This Policy</h2>
            <p className="text-gray-700">
              We may update this Privacy Policy from time to time. We will notify you of
              any changes by posting the new Privacy Policy on this page and updating the
              &quot;Last updated&quot; date.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">9. Contact Us</h2>
            <p className="text-gray-700">
              If you have questions about this Privacy Policy, please contact us at:
            </p>
            <p className="text-gray-700 mt-2">
              Email: support@fuelrx.app
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
