export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Privacy Policy</h1>
      <p className="text-sm text-slate-400 mb-8">Last updated: April 2026</p>

      <div className="prose prose-slate max-w-none text-sm leading-relaxed space-y-6">
        <section>
          <h2 className="text-base font-semibold text-slate-700 mb-2">1. Overview</h2>
          <p className="text-slate-600">
            stoaix ("we", "us", or "our") operates the platform at platform.stoaix.com. This Privacy Policy explains
            how we collect, use, and protect your information when you use our service.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-700 mb-2">2. Information We Collect</h2>
          <p className="text-slate-600">We collect information you provide directly to us, including:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-600">
            <li>Account information (name, email address)</li>
            <li>Business information entered during onboarding</li>
            <li>Google Calendar data when you connect your calendar (read/write access to calendar events only)</li>
            <li>Conversation and call data processed through our AI assistant</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-700 mb-2">3. Google Calendar Integration</h2>
          <p className="text-slate-600">
            When you connect your Google Calendar, stoaix requests access to:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-600">
            <li><strong>calendar.events</strong> — to create and manage appointment events on your behalf</li>
            <li><strong>calendar.readonly</strong> — to display your upcoming appointments within the platform</li>
          </ul>
          <p className="text-slate-600 mt-2">
            We do not share your calendar data with third parties. OAuth tokens are stored securely and used solely
            to provide the appointment scheduling feature. You can revoke access at any time from your Google Account
            settings at <a href="https://myaccount.google.com/permissions" className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">myaccount.google.com/permissions</a>.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-700 mb-2">4. How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>To provide and operate the stoaix platform</li>
            <li>To power AI assistant features on your behalf</li>
            <li>To create and display calendar appointments</li>
            <li>To improve our services</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-700 mb-2">5. Data Security</h2>
          <p className="text-slate-600">
            We implement industry-standard security measures to protect your data. All data is stored on
            Supabase (PostgreSQL) with row-level security enabled. OAuth tokens are encrypted at rest.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-700 mb-2">6. Data Retention</h2>
          <p className="text-slate-600">
            We retain your data for as long as your account is active. You may request deletion of your
            data at any time by contacting us.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-700 mb-2">7. Contact</h2>
          <p className="text-slate-600">
            If you have questions about this Privacy Policy, please contact us at{' '}
            <a href="mailto:turkozemir@gmail.com" className="text-blue-600 underline">turkozemir@gmail.com</a>.
          </p>
        </section>
      </div>
    </div>
  )
}
