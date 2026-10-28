import { formatCurrency as formatCurrencyShared } from "@/lib/format-currency";
import type {
  VendorPricingBudget,
  VendorPricingVendor,
} from "@/lib/vendor-pricing/simulated-vendor-pricing";

import {
  SIMULATED_PRICING_LABEL,
  simulateVendorPricing,
} from "@/lib/vendor-pricing/simulated-vendor-pricing";

import styles from "./vendor-pricing-panel.module.css";

type VendorPricingPanelProps = {
  vendors: VendorPricingVendor[];
  budget: VendorPricingBudget;
  guestCount: number;
};

function readableLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatMoney(amount: number, currency: string): string {
  return formatCurrencyShared(amount, currency);
}

export default function VendorPricingPanel({
  vendors,
  budget,
  guestCount,
}: VendorPricingPanelProps) {
  // Avoid repeating the same service category in the scenario list.
  const seenCategories = new Set<string>();
  const uniqueVendors = vendors.filter((vendor) => {
    if (seenCategories.has(vendor.serviceCategory)) {
      return false;
    }

    seenCategories.add(vendor.serviceCategory);
    return true;
  }).slice(0, 6);

  if (uniqueVendors.length === 0) {
    return null;
  }

  return (
    <section
      className={styles.panel}
      aria-labelledby="vendor-pricing-panel-title"
    >
      <div className={styles.heading}>
        <span className={styles.eyebrow}>DEMO PRICING ADAPTER</span>
        <h3 id="vendor-pricing-panel-title">
          Illustrative vendor pricing scenarios
        </h3>
        <p>
          Compare a transparent planning scenario for each service category.
          These figures are generated locally for demonstration; no live
          supplier or market-pricing API was queried.
        </p>
      </div>

      <div className={styles.notice} role="note">
        <strong>{SIMULATED_PRICING_LABEL}</strong>
        <span>
          These ranges are not market benchmarks, supplier offers,
          confirmed prices, or availability checks.
        </span>
      </div>

      <div className={styles.grid}>
        {uniqueVendors.map((vendor) => {
          const scenario = simulateVendorPricing({
            vendor,
            budget,
            guestCount,
          });

          return (
            <article
              className={styles.card}
              key={`${vendor.id}-${vendor.serviceCategory}`}
            >
              <div className={styles.cardHeader}>
                <span className={styles.category}>
                  {readableLabel(scenario.category)}
                </span>
                <span className={styles.simulatedTag}>SIMULATED</span>
              </div>

              <h4>Category-level scenario</h4>

              <dl className={styles.range}>
                <div>
                  <dt>Illustrative low</dt>
                  <dd>{formatMoney(scenario.lowEstimate, scenario.currency)}</dd>
                </div>
                <div className={styles.typical}>
                  <dt>Scenario baseline</dt>
                  <dd>
                    {formatMoney(
                      scenario.typicalEstimate,
                      scenario.currency,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Illustrative high</dt>
                  <dd>{formatMoney(scenario.highEstimate, scenario.currency)}</dd>
                </div>
              </dl>

              <p className={styles.basis}>{scenario.basisDescription}</p>
            </article>
          );
        })}
      </div>

      <p className={styles.footnote}>
        The low and high values are fixed illustrative multipliers around
        the baseline, not statistical confidence bounds. Existing vendor
        quotes, confirmed prices, actual expenses, and the saved event
        budget are not changed by viewing this panel.
      </p>
    </section>
  );
}