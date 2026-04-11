"use client";

import { useActionState } from "react";
import {
  purgeAuditLogsByRetentionAction,
  RETENTION_ACTION_INITIAL_STATE
} from "./actions";
import { translate, type Locale } from "@/lib/i18n/shared";
import styles from "./audit-logs.module.css";

type RetentionControlsProps = {
  defaultDays: number;
  locale: Locale;
};

export function RetentionControls({ defaultDays, locale }: RetentionControlsProps) {
  const [state, formAction, pending] = useActionState(
    purgeAuditLogsByRetentionAction,
    RETENTION_ACTION_INITIAL_STATE
  );

  return (
    <section className={styles.retentionCard}>
      <h2>{translate(locale, "admin.retention")}</h2>
      <p>{translate(locale, "admin.retentionHint")}</p>
      {state.message ? (
        <p className={state.ok ? styles.retentionSuccess : styles.retentionError}>
          {state.message}
        </p>
      ) : null}
      <form action={formAction} className={styles.retentionForm}>
        <label>
          <span>{translate(locale, "admin.daysToKeep")}</span>
          <input
            type="number"
            name="retentionDays"
            min={1}
            max={3650}
            defaultValue={defaultDays}
            required
          />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? translate(locale, "admin.purging") : translate(locale, "admin.applyRetention")}
        </button>
      </form>
    </section>
  );
}
