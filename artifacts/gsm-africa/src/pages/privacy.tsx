import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export function PrivacyPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Privacy Policy — GSM World";
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-20">
      <div className="mb-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={15} />
          Back to Home
        </Link>
      </div>

      <div className="space-y-8">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Legal</p>
          <h1 className="text-3xl font-black text-foreground mb-1">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">GSM World · Effective Date: 1 June 2025 · Last Updated: 1 June 2025</p>
        </div>

        <div className="prose prose-sm max-w-none text-foreground space-y-6">

          <section>
            <h2 className="text-lg font-black mb-2">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              GSM World ("we", "our", or "us") is committed to protecting your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your data when you use our platform, website, and related services. By using the Service, you consent to the practices described in this policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black mb-2">2. Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed mb-2">We collect the following categories of information:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 leading-relaxed">
              <li><strong className="text-foreground">Account Information:</strong> Name, email address, phone number, and password when you register.</li>
              <li><strong className="text-foreground">Order Information:</strong> Device identifiers (IMEI, serial numbers), order details, and service history.</li>
              <li><strong className="text-foreground">Payment Information:</strong> Transaction references and payment method details. We do not store full card numbers or M-Pesa PINs.</li>
              <li><strong className="text-foreground">Usage Data:</strong> IP address, browser type, pages visited, and session duration.</li>
              <li><strong className="text-foreground">Communications:</strong> Messages sent through our support chat and email correspondence.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black mb-2">3. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed mb-2">We use your information to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 leading-relaxed">
              <li>Process and fulfill your orders</li>
              <li>Send transactional emails (order confirmations, status updates, refund notices)</li>
              <li>Verify your identity and prevent fraud</li>
              <li>Improve our services and resolve technical issues</li>
              <li>Respond to customer support requests</li>
              <li>Send promotional communications (you may opt out at any time)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black mb-2">4. Email Communications</h2>
            <p className="text-muted-foreground leading-relaxed">
              We send transactional emails for order confirmations, payment notifications, status updates, and refund notifications to the email address provided during registration. These emails are sent on behalf of GSM World via our email service provider (Resend). You can opt out of non-transactional marketing emails at any time by clicking the unsubscribe link in any email or contacting us directly. Transactional emails (related to your orders and account security) cannot be disabled.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black mb-2">5. Data Sharing and Disclosure</h2>
            <p className="text-muted-foreground leading-relaxed mb-2">We do not sell your personal data. We may share it with:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 leading-relaxed">
              <li><strong className="text-foreground">Service Providers:</strong> Payment processors, IMEI lookup services, and email delivery providers who assist us in operating the platform.</li>
              <li><strong className="text-foreground">Legal Authorities:</strong> When required by law, court order, or to protect the rights and safety of our users and staff.</li>
              <li><strong className="text-foreground">Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets, your data may be transferred with appropriate notice.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black mb-2">6. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your personal data for as long as your account is active or as needed to provide services. Order records are retained for a minimum of 3 years for financial and legal compliance. You may request deletion of your account and associated data by contacting us, subject to legal retention obligations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black mb-2">7. Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement industry-standard security measures including TLS encryption for data in transit, secure password hashing, and restricted access controls. However, no internet transmission is 100% secure, and we cannot guarantee absolute security. You are responsible for keeping your account credentials confidential.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black mb-2">8. Cookies and Tracking</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use session cookies and local storage to maintain your login state and improve your experience. We do not use third-party advertising trackers. You can disable cookies in your browser settings, but some features of the platform may not function correctly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black mb-2">9. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-2">You have the right to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 leading-relaxed">
              <li>Access a copy of the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and data</li>
              <li>Opt out of marketing communications</li>
              <li>Lodge a complaint with a data protection authority</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-2">
              To exercise these rights, contact us at <a href="mailto:support@gsmworld.co.ke" className="text-primary font-semibold hover:underline">support@gsmworld.co.ke</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black mb-2">10. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our Service is not directed to individuals under the age of 18. We do not knowingly collect personal data from minors. If you believe a minor has provided us with personal data, please contact us and we will take steps to delete it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black mb-2">11. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy periodically. We will notify registered users of material changes via email. Continued use of the Service after changes are posted constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black mb-2">12. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              For any privacy-related questions or requests, please contact us at:{" "}
              <a href="mailto:support@gsmworld.co.ke" className="text-primary font-semibold hover:underline">support@gsmworld.co.ke</a>
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
