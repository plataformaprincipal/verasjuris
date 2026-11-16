"use client";

import { useLocale } from "./locale-provider";

export function AuthPageFooterLink({
  prefixKey,
  href,
  linkKey,
}: {
  prefixKey: string;
  href: string;
  linkKey: string;
}) {
  const { t } = useLocale();
  return (
    <p>
      {t(prefixKey)} <a href={href}>{t(linkKey)}</a>
    </p>
  );
}

export function AuthPageBackLink({ href, labelKey }: { href: string; labelKey: string }) {
  const { t } = useLocale();
  return (
    <p>
      <a href={href}>{t(labelKey)}</a>
    </p>
  );
}
