export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-md p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: January 2026</p>

        <div className="prose prose-gray max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-700 mb-4">
              By accessing or using FuelRx (&quot;the Service&quot;), you agree to be bound by these
              Terms of Service. If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">2. Description of Service</h2>
            <p className="text-gray-700 mb-4">
              FuelRx is an AI-powered meal planning application that helps users create
              personalized weekly meal plans, generate grocery lists, and track their nutrition.
              The Service is designed for informational purposes and should not replace
              professional medical or nutritional advice.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">3. User Accounts</h2>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>You must provide accurate and complete registration information</li>
              <li>You are responsible for maintaining the security of your account</li>
              <li>You must notify us immediately of any unauthorized use</li>
              <li>You may not share your account with others</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">4. Acceptable Use</h2>
            <p className="text-gray-700 mb-4">You agree not to:</p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Use the Service for any illegal purpose</li>
              <li>Upload harmful, offensive, or inappropriate content</li>
              <li>Attempt to gain unauthorized access to the Service</li>
              <li>Interfere with or disrupt the Service</li>
              <li>Use automated systems to access the Service without permission</li>
              <li>Resell or redistribute the Service without authorization</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">5. Intellectual Property</h2>
            <p className="text-gray-700 mb-4">
              The Service and its original content, features, and functionality are owned
              by FuelRx and are protected by international copyright, trademark, and other
              intellectual property laws.
            </p>
            <p className="text-gray-700">
              You retain ownership of content you upload (such as meal photos), but grant
              us a license to use this content to provide and improve the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">6. Health Disclaimer</h2>
            <p className="text-gray-700 mb-4">
              <strong>Important:</strong> FuelRx provides general nutritional information
              and meal suggestions. The Service is not intended to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Provide medical advice or diagnosis</li>
              <li>Replace consultation with healthcare professionals</li>
              <li>Treat, cure, or prevent any disease or condition</li>
            </ul>
            <p className="text-gray-700">
              Always consult with a qualified healthcare provider before making significant
              changes to your diet, especially if you have medical conditions or allergies.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">7. AI-Generated Content</h2>
            <p className="text-gray-700 mb-4">
              Meal plans and nutritional analysis are generated using artificial intelligence.
              While we strive for accuracy, AI-generated content may contain errors. Users
              should verify nutritional information and adjust recipes based on their own
              dietary needs and preferences.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">8. Limitation of Liability</h2>
            <p className="text-gray-700 mb-4">
              To the maximum extent permitted by law, FuelRx shall not be liable for any
              indirect, incidental, special, consequential, or punitive damages resulting
              from your use of the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">9. Termination</h2>
            <p className="text-gray-700 mb-4">
              We may terminate or suspend your account at any time for violations of these
              Terms. You may delete your account at any time through the app settings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">10. Changes to Terms</h2>
            <p className="text-gray-700">
              We reserve the right to modify these Terms at any time. We will notify users
              of significant changes. Continued use of the Service after changes constitutes
              acceptance of the new Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">11. Contact</h2>
            <p className="text-gray-700">
              For questions about these Terms, contact us at support@fuelrx.app.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
