"use client";

import { useActionState } from "react";
import {
  purgeAuditLogsByRetentionAction,
  RETENTION_ACTION_INITIAL_STATE
} from "./actions";
import styles from "./audit-logs.module.css";

type RetentionControlsProps = {
  defaultDays: number;
};

export function RetentionControls({ defaultDays }: RetentionControlsProps) {
  const [state, formAction, pending] = useActionState(
    purgeAuditLogsByRetentionAction,
    RETENTION_ACTION_INITIAL_STATE
  );

  return (
    <section className={styles.retentionCard}>
      <h2>Retention</h2>
      <p>Delete logs older than a chosen number of days.</p>
      {state.message ? (
        <p className={state.ok ? styles.retentionSuccess : styles.retentionError}>
          {state.message}
        </p>
      ) : null}
      <form action={formAction} className={styles.retentionForm}>
        <label>
          <span>Days to keep</span>
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
          {pending ? "Purging..." : "Apply retention"}
        </button>
      </form>
    </section>
  );
}
