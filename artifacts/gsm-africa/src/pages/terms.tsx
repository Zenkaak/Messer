import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export function TermsPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Terms and Conditions — GSM World";
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
          <h1 className="text-3xl font-black text-foreground mb-1">Terms and Conditions</h1>
          <p className="text-sm text-muted-foreground">GSM World · Effective Date: 1 June 2025 · Last Updated: 1 June 2025</p>
        </div>

        <div className="prose prose-sm max-w-none text-foreground space-y-6">

          <section>
            <h2 className="text-lg font-black mb-2">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using the GSM World platform, website, mobile application, or any related services (collectively, "the Service"), you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please discontinue use of the Service immediately. These terms apply to all visitors, registered users, resellers, and purchasers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black mb-2">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              GSM World provides digital services including but not limited to IMEI unlocking, FRP removal, Android and iPhone unlocking, activation services, gift cards, and related digital tools. All services are delivered digitally. Physical goods are not sold through this platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black mb-2">3. User Accounts</h2>
            <p className="text-muted-foreground leading-relaxed">
              To access certain features, you must create an account. You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use. GSM World reserves the right to suspend or terminate accounts that violate these terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black mb-2">4. Orders and Payments</h2>
            <p className="text-muted-foreground leading-relaxed">
              All orders are subject to availability and acceptance. Prices are listed in USD. We accept payment via M-Pesa, cryptocurrency (via NOWPayments and Binance Pay), and GSM World Wallet credits. Payment must be completed before service delivery. GSM World reserves the right to cancel any order and issue a refund at its sole discretion.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black mb-2">5. Refund Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Refunds are considered on a case-by-case basis. A refund may be issued if: (a) the service could not be delivered due to a technical failure on our part; (b) an incorrect service was provided. Refunds are not issued for successfully completed services, for devices reported as blacklisted, or where incorrect device information was provided by the customer. To request a refund, contact our support team within 7 days of your order date.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black mb-2">6. Prohibited Use</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree not to use the Service for any unlawful purpose, including but not limited to: unlocking stolen devices, bypassing security on devices you do not own or are not authorized to service, fraudulent transactions, or any activity that violates applicable laws in your jurisdiction. GSM World cooperates fully with law enforcement investigations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black mb-2">7. Reseller Program</h2>
            <p className="text-muted-foreground leading-relaxed">
              Participation in the GSM World Reseller Program is subject to approval. Resellers earn a commission on referred sales as specified in their account dashboard. GSM World reserves the right to modify commission rates with 14 days notice, suspend or terminate reseller accounts that violate these terms, and withhold earnings pending investigation of suspected fraud or abuse.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black mb-2">8. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              All content on this platform — including logos, text, graphics, software, and service names — is the property of GSM World and protected by applicable copyright and trademark laws. You may not reproduce, distribute, or create derivative works without prior written consent.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black mb-2">9. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              GSM World shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service. Our total liability shall not exceed the amount paid by you for the specific service giving rise to the claim. We do not guarantee that the Service will be error-free or uninterrupted.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black mb-2">10. Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your use of the Service is also governed by our <Link href="/privacy" className="text-primary font-semibold hover:underline">Privacy Policy</Link>, which is incorporated into these Terms by reference. By using the Service, you consent to the collection and use of your information as described in the Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black mb-2">11. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              GSM World reserves the right to modify these Terms at any time. Continued use of the Service after changes are posted constitutes acceptance of the revised Terms. We will notify registered users of material changes via email.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black mb-2">12. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of Kenya. Any disputes arising from these Terms shall be subject to the jurisdiction of the courts of Kenya.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black mb-2">13. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For questions about these Terms, please contact us at{" "}
              <a href="mailto:support@gsmworld.co.ke" className="text-primary font-semibold hover:underline">support@gsmworld.co.ke</a>.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
