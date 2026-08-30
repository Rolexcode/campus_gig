export type RegistrationRecord = {
  createdAt: string | null;
  emailVerified: boolean;
  disabled: boolean;
};

export type RegistrationMetrics = {
  totalUsers: number;
  registeredToday: number;
  registeredThisWeek: number;
  registeredThisMonth: number;
  emailVerifiedUsers: number;
  disabledUsers: number;
};

function utcStartOfDay(now: Date) {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function utcStartOfWeek(now: Date) {
  const startOfDay = utcStartOfDay(now);
  const mondayOffset = (now.getUTCDay() + 6) % 7;
  return startOfDay - mondayOffset * 24 * 60 * 60 * 1000;
}

function utcStartOfMonth(now: Date) {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
}

export function calculateRegistrationMetrics(
  records: RegistrationRecord[],
  now = new Date(),
): RegistrationMetrics {
  const today = utcStartOfDay(now);
  const week = utcStartOfWeek(now);
  const month = utcStartOfMonth(now);

  return records.reduce<RegistrationMetrics>(
    (metrics, record) => {
      metrics.totalUsers += 1;
      if (record.emailVerified) metrics.emailVerifiedUsers += 1;
      if (record.disabled) metrics.disabledUsers += 1;

      const createdAt = record.createdAt ? Date.parse(record.createdAt) : Number.NaN;
      if (!Number.isFinite(createdAt) || createdAt > now.getTime()) return metrics;
      if (createdAt >= today) metrics.registeredToday += 1;
      if (createdAt >= week) metrics.registeredThisWeek += 1;
      if (createdAt >= month) metrics.registeredThisMonth += 1;
      return metrics;
    },
    {
      totalUsers: 0,
      registeredToday: 0,
      registeredThisWeek: 0,
      registeredThisMonth: 0,
      emailVerifiedUsers: 0,
      disabledUsers: 0,
    },
  );
}
