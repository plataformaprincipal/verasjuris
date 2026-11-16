"use client";

import { CSRF_HEADER } from "@verasjuris/security/constants";
import { Button, FormField, Input, Select, Textarea } from "@verasjuris/ui";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  BR_STATES,
  INITIAL_WIZARD_STATE,
  PARTNER_CATEGORIES,
  PUBLIC_PERSONAS,
  STEP_TITLES,
  buildRegisterPayload,
  digitsOnly,
  getWizardSteps,
  hasErrors,
  mapServerErrors,
  maskCep,
  maskCnpj,
  maskCpf,
  maskPhone,
  passwordStrength,
  personaIsOrganization,
  personaIsPartner,
  personaNeedsBirthDate,
  personaNeedsOab,
  resolveWizardRedirect,
  validateAll,
  validateStep,
  type WizardErrors,
  type WizardPersona,
  type WizardState,
  type WizardStepId,
} from "../lib/registration-wizard";
import { isCommonPassword, isValidCep } from "../lib/br-masks";
import { interpolate } from "../lib/i18n";
import { translateApiFailure, translateFieldError } from "../lib/i18n/api-errors";
import type { ApiFailure } from "../lib/types";
import { LegalPreviewCards } from "./legal/legal-preview-cards";
import { useLocale } from "./locale-provider";

type CepStatus = "idle" | "loading" | "found" | "failed";

type RegisterSuccess = {
  status?: string;
  redirectTo?: string;
  emailVerified?: boolean;
  message?: string;
};

type TextFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  type?: string;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "tel" | "email";
  maxLength?: number;
  max?: string;
  required?: boolean;
  placeholder?: string;
  onBlur?: () => void;
};

function describedBy(id: string, hint?: string, error?: string) {
  return (
    [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") ||
    undefined
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  type = "text",
  autoComplete,
  inputMode,
  maxLength,
  max,
  required,
  placeholder,
  onBlur,
}: TextFieldProps) {
  return (
    <FormField id={id} label={required ? `${label} *` : label} hint={hint} error={error}>
      <Input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        onBlur={onBlur}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        max={max}
        placeholder={placeholder}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
      />
    </FormField>
  );
}

function PasswordInput({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  autoComplete,
  show,
  onToggle,
  showLabel,
  hideLabel,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  autoComplete: string;
  show: boolean;
  onToggle: () => void;
  showLabel: string;
  hideLabel: string;
}) {
  return (
    <FormField id={id} label={`${label} *`} hint={hint} error={error}>
      <div className="vj-password-field">
        <Input
          id={id}
          name={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          aria-required
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
        />
        <button
          type="button"
          className="vj-button vj-button-secondary vj-password-toggle"
          aria-pressed={show}
          aria-controls={id}
          aria-label={show ? hideLabel : showLabel}
          onClick={onToggle}
        >
          {show ? hideLabel : showLabel}
        </button>
      </div>
    </FormField>
  );
}

function CheckField({
  id,
  checked,
  onChange,
  error,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="vj-field">
      <label className="vj-check-row" htmlFor={id}>
        <input
          id={id}
          name={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <span>{children}</span>
      </label>
      {error ? (
        <p className="vj-field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="vj-wizard-review-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function strengthLabelKey(score: 0 | 1 | 2 | 3, common: boolean, empty: boolean): string {
  if (empty) return "register.password.strength.none";
  if (common) return "register.password.strength.common";
  if (score <= 1) return "register.password.strength.fail";
  if (score === 2) return "register.password.strength.good";
  return "register.password.strength.excellent";
}

export function RegistrationWizard({ redirectTo }: { redirectTo?: string | null }) {
  const router = useRouter();
  const { t } = useLocale();
  const uid = useId();
  const [state, setState] = useState<WizardState>(INITIAL_WIZARD_STATE);
  const [errors, setErrors] = useState<WizardErrors>({});
  const [stepId, setStepId] = useState<WizardStepId>("persona");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<RegisterSuccess | null>(null);
  const [cepStatus, setCepStatus] = useState<CepStatus>("idle");
  const [cepMessageKey, setCepMessageKey] = useState<string | null>(null);
  const [cepServerMessage, setCepServerMessage] = useState<string | null>(null);
  const [focusTick, setFocusTick] = useState(0);

  const submittingRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const rootRef = useRef<HTMLFormElement>(null);
  const cepAbortRef = useRef<AbortController | null>(null);
  const lastCepRef = useRef<string>("");
  const mountedRef = useRef(false);
  const focusInvalidRef = useRef(false);

  const steps = useMemo(() => getWizardSteps(state.persona), [state.persona]);
  const stepIndex = Math.max(0, steps.indexOf(stepId));
  const isLast = stepIndex === steps.length - 1;
  const strength = passwordStrength(state.password);
  const commonPassword = state.password.length > 0 && isCommonPassword(state.password);
  const isOrg = personaIsOrganization(state.persona);

  const fid = (name: string) => `${uid}-${name}`;
  const te = (key?: string) => (key ? t(key, key) : undefined);

  useEffect(
    () => () => {
      cepAbortRef.current?.abort();
    },
    [],
  );

  // Move o foco ao mudar de etapa (ou ao primeiro campo inválido após tentar avançar).
  // biome-ignore lint/correctness/useExhaustiveDependencies: stepId/focusTick are intentional triggers
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (focusInvalidRef.current) {
      focusInvalidRef.current = false;
      const invalid = rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
      if (invalid) {
        invalid.focus();
        return;
      }
    }
    headingRef.current?.focus();
  }, [stepId, focusTick]);

  const setField = useCallback(<K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setState((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  async function lookupCep(rawCep: string) {
    const cep = digitsOnly(rawCep);
    if (!isValidCep(cep) || lastCepRef.current === cep) return;
    lastCepRef.current = cep;
    cepAbortRef.current?.abort();
    const controller = new AbortController();
    cepAbortRef.current = controller;
    setCepStatus("loading");
    setCepMessageKey(null);
    setCepServerMessage(null);
    try {
      const response = await fetch(`/api/address/cep/${cep}`, {
        signal: controller.signal,
        headers: { accept: "application/json" },
      });
      const data = (await response.json().catch(() => ({}))) as {
        street?: string;
        district?: string;
        city?: string;
        state?: string;
        error?: { message?: string };
      };
      if (controller.signal.aborted) return;
      if (!response.ok) {
        setCepStatus("failed");
        setCepMessageKey("register.field.cepFailed");
        setCepServerMessage(data.error?.message ?? null);
        return;
      }
      setState((current) => ({
        ...current,
        street: data.street?.trim() || current.street,
        district: data.district?.trim() || current.district,
        city: data.city?.trim() || current.city,
        state: data.state?.trim().toUpperCase() || current.state,
      }));
      setErrors((current) => {
        const next = { ...current };
        delete next.postalCode;
        if (data.street?.trim()) delete next.street;
        if (data.district?.trim()) delete next.district;
        if (data.city?.trim()) delete next.city;
        if (data.state?.trim()) delete next.state;
        return next;
      });
      setCepStatus("found");
      setCepMessageKey("register.field.cepFound");
      setCepServerMessage(null);
    } catch {
      if (controller.signal.aborted) return;
      setCepStatus("failed");
      setCepMessageKey("register.field.cepFailed");
      setCepServerMessage(null);
    }
  }

  function onCepChange(value: string) {
    const masked = maskCep(value);
    setField("postalCode", masked);
    const digits = digitsOnly(masked);
    if (digits.length < 8) {
      lastCepRef.current = "";
      if (cepStatus !== "idle") {
        setCepStatus("idle");
        setCepMessageKey(null);
        setCepServerMessage(null);
      }
      return;
    }
    void lookupCep(digits);
  }

  function goTo(target: WizardStepId) {
    setSubmitError(null);
    setStepId(target);
  }

  function handleNext() {
    const stepErrors = validateStep(stepId, state);
    setErrors(stepErrors);
    if (hasErrors(stepErrors)) {
      focusInvalidRef.current = true;
      setFocusTick((tick) => tick + 1);
      return;
    }
    const next = steps[stepIndex + 1];
    if (next) goTo(next);
  }

  function handleBack() {
    const previous = steps[stepIndex - 1];
    if (previous) {
      setErrors({});
      goTo(previous);
    }
  }

  async function handleSubmit() {
    if (submittingRef.current || success) return;
    const failure = validateAll(state);
    if (failure) {
      setErrors(failure.errors);
      focusInvalidRef.current = true;
      if (failure.stepId !== stepId) setStepId(failure.stepId);
      setFocusTick((tick) => tick + 1);
      return;
    }

    submittingRef.current = true;
    setPending(true);
    setSubmitError(null);
    try {
      const response = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json", [CSRF_HEADER]: "1" },
        body: JSON.stringify(buildRegisterPayload(state)),
      });
      const data = (await response.json().catch(() => ({}))) as ApiFailure & RegisterSuccess;

      if (response.status !== 201) {
        const mapped = mapServerErrors(data.error?.details, (path, message) =>
          translateFieldError(path, message, t),
        );
        const fallback =
          response.status >= 500 ? t("register.errors.server") : t("register.errors.createFailed");
        setSubmitError(translateApiFailure(data, t, fallback));
        if (hasErrors(mapped.errors)) {
          setErrors(mapped.errors);
          if (mapped.firstStep && steps.includes(mapped.firstStep)) setStepId(mapped.firstStep);
          focusInvalidRef.current = true;
          setFocusTick((tick) => tick + 1);
        }
        submittingRef.current = false;
        setPending(false);
        return;
      }

      // Sucesso real (201): descarta a senha da memória e segue para a área autenticada.
      setState((current) => ({ ...current, password: "", passwordConfirm: "" }));
      setSuccess(data);
      const target = resolveWizardRedirect(redirectTo ?? null, data.redirectTo);
      router.push(target);
      router.refresh();
    } catch {
      setSubmitError(t("register.errors.network"));
      submittingRef.current = false;
      setPending(false);
    }
  }

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || success) return;
    if (isLast) void handleSubmit();
    else handleNext();
  }

  // ---------------------------------------------------------------------------
  // Etapas
  // ---------------------------------------------------------------------------

  function renderPersona() {
    const collaboratorId = fid("collaborator");
    return (
      <div className="vj-stack">
        <fieldset className="vj-stack" aria-labelledby={fid("persona-legend")}>
          <legend id={fid("persona-legend")} className="vj-label">
            {t("register.persona.question")} *
          </legend>
          <div className="vj-persona-grid">
            {PUBLIC_PERSONAS.map((persona: WizardPersona) => (
              <button
                key={persona}
                type="button"
                className="vj-persona-card"
                aria-pressed={state.persona === persona}
                aria-describedby={fid(`persona-${persona}`)}
                onClick={() => setField("persona", persona)}
              >
                <strong>{t(`register.persona.${persona}`)}</strong>
                <span id={fid(`persona-${persona}`)}>{t(`register.persona.${persona}.desc`)}</span>
              </button>
            ))}
          </div>
          {errors.persona ? (
            <p className="vj-field-error" role="alert">
              {te(errors.persona)}
            </p>
          ) : null}
        </fieldset>
        <p className="vj-hint" id={collaboratorId}>
          {t("register.persona.inviteFull")}{" "}
          <a href="/convite">{t("register.persona.inviteLink")}</a>.
        </p>
      </div>
    );
  }

  function renderIdentification() {
    const org = isOrg;
    return (
      <div className="vj-stack">
        <TextField
          id={fid("fullName")}
          label={org ? t("register.field.fullNameResponsible") : t("register.field.fullName")}
          value={state.fullName}
          onChange={(value) => setField("fullName", value)}
          error={te(errors.fullName)}
          autoComplete="name"
          maxLength={120}
          required
        />
        <TextField
          id={fid("socialName")}
          label={t("register.field.socialNameOptional")}
          value={state.socialName}
          onChange={(value) => setField("socialName", value)}
          error={te(errors.socialName)}
          hint={t("register.field.socialNameHint")}
          autoComplete="nickname"
          maxLength={120}
        />
        <TextField
          id={fid("cpf")}
          label={org ? t("register.field.cpfResponsible") : t("register.field.cpf")}
          value={state.cpf}
          onChange={(value) => setField("cpf", maskCpf(value))}
          error={te(errors.cpf)}
          inputMode="numeric"
          autoComplete="off"
          maxLength={14}
          placeholder="000.000.000-00"
          required
        />
        {personaNeedsBirthDate(state.persona) ? (
          <TextField
            id={fid("birthDate")}
            label={t("register.field.birthDate")}
            type="date"
            value={state.birthDate}
            onChange={(value) => setField("birthDate", value)}
            error={te(errors.birthDate)}
            autoComplete="bday"
            max={new Date().toISOString().slice(0, 10)}
            required
          />
        ) : null}
      </div>
    );
  }

  function renderContact() {
    return (
      <div className="vj-stack">
        <TextField
          id={fid("email")}
          label={t("register.field.email")}
          type="email"
          value={state.email}
          onChange={(value) => setField("email", value)}
          error={te(errors.email)}
          autoComplete="email"
          inputMode="email"
          maxLength={320}
          required
        />
        <FormField
          id={fid("phone")}
          label={`${t("register.field.phoneWithDdd")} *`}
          hint={t("register.field.phoneHint")}
          error={te(errors.phone)}
        >
          <div className="vj-wizard-phone">
            <span className="vj-wizard-phone-prefix" aria-hidden="true">
              +55
            </span>
            <Input
              id={fid("phone")}
              name="phone"
              type="tel"
              value={state.phone}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setField("phone", maskPhone(event.target.value))
              }
              autoComplete="tel-national"
              inputMode="tel"
              placeholder="(11) 91234-5678"
              aria-required
              aria-invalid={errors.phone ? true : undefined}
              aria-describedby={describedBy(fid("phone"), "hint", errors.phone)}
            />
          </div>
        </FormField>
      </div>
    );
  }

  function renderAddress() {
    const cepMessage =
      cepServerMessage ??
      (cepMessageKey ? t(cepMessageKey) : null) ??
      (cepStatus === "loading" ? t("register.field.cepLoading") : null);

    return (
      <div className="vj-stack">
        <TextField
          id={fid("postalCode")}
          label={t("register.field.postalCode")}
          value={state.postalCode}
          onChange={onCepChange}
          error={te(errors.postalCode)}
          hint={t("register.field.cepHint")}
          autoComplete="postal-code"
          inputMode="numeric"
          maxLength={9}
          placeholder="00000-000"
          required
        />
        {cepStatus === "loading" ? (
          <p className="vj-hint" role="status">
            {t("register.field.cepLoading")}
          </p>
        ) : null}
        {cepMessage && cepStatus !== "loading" ? (
          <p
            className={cepStatus === "failed" ? "vj-field-error" : "vj-hint"}
            role={cepStatus === "failed" ? "alert" : "status"}
          >
            {cepMessage}
          </p>
        ) : null}
        <TextField
          id={fid("street")}
          label={t("register.field.street")}
          value={state.street}
          onChange={(value) => setField("street", value)}
          error={te(errors.street)}
          autoComplete="address-line1"
          maxLength={160}
          required
        />
        <div className="vj-wizard-row">
          <TextField
            id={fid("number")}
            label={t("register.field.number")}
            value={state.number}
            onChange={(value) => setField("number", value)}
            error={te(errors.number)}
            autoComplete="off"
            maxLength={20}
            required
          />
          <TextField
            id={fid("complement")}
            label={t("register.field.complementOptional")}
            value={state.complement}
            onChange={(value) => setField("complement", value)}
            error={te(errors.complement)}
            autoComplete="address-line2"
            maxLength={80}
          />
        </div>
        <TextField
          id={fid("district")}
          label={t("register.field.district")}
          value={state.district}
          onChange={(value) => setField("district", value)}
          error={te(errors.district)}
          autoComplete="address-level3"
          maxLength={80}
          required
        />
        <div className="vj-wizard-row">
          <TextField
            id={fid("city")}
            label={t("register.field.city")}
            value={state.city}
            onChange={(value) => setField("city", value)}
            error={te(errors.city)}
            autoComplete="address-level2"
            maxLength={80}
            required
          />
          <FormField
            id={fid("state")}
            label={`${t("register.field.uf")} *`}
            error={te(errors.state)}
          >
            <Select
              id={fid("state")}
              name="state"
              value={state.state}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                setField("state", event.target.value)
              }
              autoComplete="address-level1"
              aria-required
              aria-invalid={errors.state ? true : undefined}
              aria-describedby={describedBy(fid("state"), undefined, errors.state)}
            >
              <option value="">{t("common.select")}</option>
              {BR_STATES.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </div>
    );
  }

  function renderProfile() {
    const persona = state.persona;
    const partner = personaIsPartner(persona);
    return (
      <div className="vj-stack">
        {isOrg || partner ? (
          <>
            <TextField
              id={fid("organizationName")}
              label={
                partner
                  ? t("register.field.organizationNameOptional")
                  : t("register.field.organizationName")
              }
              value={state.organizationName}
              onChange={(value) => setField("organizationName", value)}
              error={te(errors.organizationName)}
              autoComplete="organization"
              maxLength={120}
              required={!partner}
            />
            {isOrg ? (
              <TextField
                id={fid("tradeName")}
                label={t("register.field.tradeNameOptional")}
                value={state.tradeName}
                onChange={(value) => setField("tradeName", value)}
                error={te(errors.tradeName)}
                maxLength={120}
              />
            ) : null}
            <TextField
              id={fid("cnpj")}
              label={partner ? t("register.field.cnpjOptional") : t("register.field.cnpj")}
              value={state.cnpj}
              onChange={(value) => setField("cnpj", maskCnpj(value))}
              error={te(errors.cnpj)}
              inputMode="numeric"
              autoComplete="off"
              maxLength={18}
              placeholder="00.000.000/0000-00"
              required={!partner}
            />
            {isOrg ? (
              <TextField
                id={fid("jobTitle")}
                label={t("register.field.jobTitleOptional")}
                value={state.jobTitle}
                onChange={(value) => setField("jobTitle", value)}
                error={te(errors.jobTitle)}
                autoComplete="organization-title"
                maxLength={80}
              />
            ) : null}
          </>
        ) : null}

        {personaNeedsOab(persona) ? (
          <>
            <div className="vj-wizard-row">
              <TextField
                id={fid("oabNumber")}
                label={t("register.field.oabNumber")}
                value={state.oabNumber}
                onChange={(value) => setField("oabNumber", digitsOnly(value).slice(0, 20))}
                error={te(errors.oabNumber)}
                inputMode="numeric"
                autoComplete="off"
                maxLength={20}
                required
              />
              <FormField
                id={fid("oabUf")}
                label={`${t("register.field.oabUfShort")} *`}
                error={te(errors.oabUf)}
              >
                <Select
                  id={fid("oabUf")}
                  name="oabUf"
                  value={state.oabUf}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                    setField("oabUf", event.target.value)
                  }
                  aria-required
                  aria-invalid={errors.oabUf ? true : undefined}
                  aria-describedby={describedBy(fid("oabUf"), undefined, errors.oabUf)}
                >
                  <option value="">{t("common.select")}</option>
                  {BR_STATES.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
            <p className="vj-hint">{t("register.field.oabDeclaratoryHint")}</p>
            <FormField
              id={fid("practiceAreas")}
              label={t("register.field.practiceAreasOptional")}
              error={te(errors.practiceAreas)}
            >
              <Textarea
                id={fid("practiceAreas")}
                name="practiceAreas"
                value={state.practiceAreas}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                  setField("practiceAreas", event.target.value)
                }
                maxLength={400}
                rows={3}
                aria-invalid={errors.practiceAreas ? true : undefined}
                aria-describedby={describedBy(
                  fid("practiceAreas"),
                  undefined,
                  errors.practiceAreas,
                )}
              />
            </FormField>
          </>
        ) : null}

        {partner ? (
          <>
            <FormField
              id={fid("partnerCategory")}
              label={`${t("register.field.partnerCategory")} *`}
              error={te(errors.partnerCategory)}
            >
              <Select
                id={fid("partnerCategory")}
                name="partnerCategory"
                value={state.partnerCategory}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  setField("partnerCategory", event.target.value)
                }
                aria-required
                aria-invalid={errors.partnerCategory ? true : undefined}
                aria-describedby={describedBy(
                  fid("partnerCategory"),
                  undefined,
                  errors.partnerCategory,
                )}
              >
                <option value="">{t("common.select")}</option>
                {PARTNER_CATEGORIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {t(item.labelKey)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              id={fid("partnerDescription")}
              label={t("register.field.partnerDescriptionOptional")}
              error={te(errors.partnerDescription)}
            >
              <Textarea
                id={fid("partnerDescription")}
                name="partnerDescription"
                value={state.partnerDescription}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                  setField("partnerDescription", event.target.value)
                }
                maxLength={600}
                rows={4}
                aria-invalid={errors.partnerDescription ? true : undefined}
                aria-describedby={describedBy(
                  fid("partnerDescription"),
                  undefined,
                  errors.partnerDescription,
                )}
              />
            </FormField>
          </>
        ) : null}
      </div>
    );
  }

  function renderPassword() {
    const meterId = fid("password-meter");
    const requirementsId = fid("password-requirements");
    const requirements = strength.requirements;
    const requirementItems: Array<{
      key: keyof typeof requirements;
      labelKey: string;
      ok: boolean;
    }> = [
      { key: "minLength", labelKey: "register.password.req.minLength", ok: requirements.minLength },
      { key: "uppercase", labelKey: "register.password.req.uppercase", ok: requirements.uppercase },
      { key: "lowercase", labelKey: "register.password.req.lowercase", ok: requirements.lowercase },
      { key: "number", labelKey: "register.password.req.number", ok: requirements.number },
      { key: "special", labelKey: "register.password.req.special", ok: requirements.special },
    ];
    const label = t(strengthLabelKey(strength.score, commonPassword, state.password.length === 0));
    const acceptanceNote =
      strength.classification === "boa" || strength.classification === "excelente"
        ? t("register.password.accepted")
        : state.password.length > 0
          ? t("register.password.notAcceptedYet")
          : "";

    return (
      <div className="vj-stack">
        <PasswordInput
          id={fid("password")}
          label={t("register.field.password")}
          value={state.password}
          onChange={(value) => setField("password", value)}
          error={te(errors.password)}
          hint={t("register.password.hintExtended")}
          autoComplete="new-password"
          show={showPassword}
          onToggle={() => setShowPassword((value) => !value)}
          showLabel={t("register.show")}
          hideLabel={t("register.hide")}
        />
        <ul
          className="vj-password-requirements"
          id={requirementsId}
          aria-label={t("register.password.requirementsAria")}
        >
          {requirementItems.map((item) => (
            <li key={item.key} data-met={item.ok ? "true" : "false"}>
              <span className="vj-password-requirement-mark" aria-hidden="true" />
              <span className="vj-visually-hidden">
                {item.ok ? t("register.password.met") : t("register.password.pending")}{" "}
              </span>
              {t(item.labelKey)}
            </li>
          ))}
        </ul>
        <div className="vj-password-meter" id={meterId} role="status" aria-live="polite">
          <div className="vj-password-meter-track" aria-hidden="true">
            <div className="vj-password-meter-bar" data-score={strength.score} />
          </div>
          <span>
            {t("register.password.classification")}: <strong>{label}</strong>
            {acceptanceNote ? ` · ${acceptanceNote}` : ""}
          </span>
        </div>
        {commonPassword ? (
          <p className="vj-field-error" role="status">
            {t("register.password.commonWarning")}
          </p>
        ) : null}
        <PasswordInput
          id={fid("passwordConfirm")}
          label={t("register.field.passwordConfirm")}
          value={state.passwordConfirm}
          onChange={(value) => setField("passwordConfirm", value)}
          error={te(errors.passwordConfirm)}
          autoComplete="new-password"
          show={showPassword}
          onToggle={() => setShowPassword((value) => !value)}
          showLabel={t("register.show")}
          hideLabel={t("register.hide")}
        />
        <p className="vj-hint">{t("register.password.policyNote")}</p>
      </div>
    );
  }

  function renderReview() {
    const persona = state.persona;
    const partnerLabelKey = PARTNER_CATEGORIES.find(
      (item) => item.value === state.partnerCategory,
    )?.labelKey;
    const rows: Array<{
      step: WizardStepId;
      titleKey: string;
      items: Array<[string, string | undefined]>;
    }> = [
      {
        step: "persona",
        titleKey: "register.step.persona",
        items: [
          [
            t("register.review.accountType"),
            persona ? t(`register.persona.${persona}`) : undefined,
          ],
        ],
      },
      {
        step: "identification",
        titleKey: "register.step.identification",
        items: [
          [t("register.review.name"), state.fullName.trim()],
          [t("register.field.socialName"), state.socialName.trim()],
          [t("register.field.cpf"), state.cpf],
          [
            t("register.review.birth"),
            personaNeedsBirthDate(persona) ? state.birthDate : undefined,
          ],
        ],
      },
      {
        step: "contact",
        titleKey: "register.step.contact",
        items: [
          [t("register.field.email"), state.email.trim()],
          [t("register.review.mobile"), state.phone ? `+55 ${state.phone}` : undefined],
        ],
      },
      {
        step: "address",
        titleKey: "register.step.address",
        items: [
          [
            t("register.review.addressLine"),
            `${state.street.trim()}, ${state.number.trim()}${state.complement.trim() ? ` – ${state.complement.trim()}` : ""}`,
          ],
          [t("register.field.district"), state.district.trim()],
          [
            t("register.review.cityState"),
            `${state.city.trim()} / ${state.state.trim().toUpperCase()}`,
          ],
          [t("register.field.postalCode"), state.postalCode],
        ],
      },
    ];
    if (steps.includes("profile")) {
      rows.push({
        step: "profile",
        titleKey: "register.step.profile",
        items: [
          [t("register.review.organization"), state.organizationName.trim()],
          [t("register.field.cnpj"), state.cnpj],
          [
            t("register.review.oab"),
            personaNeedsOab(persona) ? `${state.oabNumber}/${state.oabUf}` : undefined,
          ],
          [t("register.review.category"), partnerLabelKey ? t(partnerLabelKey) : undefined],
        ],
      });
    }

    return (
      <div className="vj-stack">
        <ul className="vj-stack" aria-label={t("register.review.summary")}>
          {rows.map((row) => {
            const title = t(row.titleKey);
            return (
              <li key={row.step} className="vj-wizard-review">
                <div className="vj-wizard-review-head">
                  <h3 className="vj-wizard-review-title">{title}</h3>
                  <button
                    type="button"
                    className="vj-button vj-button-ghost"
                    onClick={() => goTo(row.step)}
                    aria-label={interpolate(t("register.review.editAria"), { step: title })}
                  >
                    {t("register.review.edit")}
                  </button>
                </div>
                <dl>
                  {row.items.map(([label, value]) => (
                    <ReviewRow key={label} label={label} value={value} />
                  ))}
                </dl>
              </li>
            );
          })}
        </ul>

        <LegalPreviewCards />

        <fieldset className="vj-wizard-fieldset">
          <legend className="vj-label">{t("register.review.consents")}</legend>
          <CheckField
            id={fid("acceptTerms")}
            checked={state.acceptTerms && state.acceptPrivacy}
            onChange={(value) => {
              setField("acceptTerms", value);
              setField("acceptPrivacy", value);
            }}
            error={te(errors.acceptTerms) ?? te(errors.acceptPrivacy)}
          >
            {t("register.field.acceptLegalBundle", "Declaro que li e concordo com os")}{" "}
            <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer">
              {t("footer.terms", "Termos de Uso")}
            </a>{" "}
            {t("register.field.acceptLegalAnd", "e os")}{" "}
            <a href="/termos-de-servico" target="_blank" rel="noopener noreferrer">
              {t("footer.termsOfService", "Termos de Serviço")}
            </a>{" "}
            {t("register.field.acceptLegalOf", "do VerasJuris e que tomei conhecimento da")}{" "}
            <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer">
              {t("footer.privacyPolicy", "Política de Privacidade")}
            </a>
            . *
          </CheckField>
          <p className="vj-hint">
            {t(
              "register.field.privacyAckHint",
              "A ciência da Política de Privacidade não constitui consentimento genérico para todos os tratamentos de dados.",
            )}
          </p>
          {isOrg ? (
            <CheckField
              id={fid("representationDeclaration")}
              checked={state.representationDeclaration}
              onChange={(value) => setField("representationDeclaration", value)}
              error={te(errors.representationDeclaration)}
            >
              {t("register.field.representationFull")} *
            </CheckField>
          ) : null}
          <CheckField
            id={fid("acceptMarketing")}
            checked={state.acceptMarketing}
            onChange={(value) => setField("acceptMarketing", value)}
          >
            {t("register.field.acceptMarketingFull")}
          </CheckField>
        </fieldset>
      </div>
    );
  }

  function renderStep() {
    switch (stepId) {
      case "persona":
        return renderPersona();
      case "identification":
        return renderIdentification();
      case "contact":
        return renderContact();
      case "address":
        return renderAddress();
      case "profile":
        return renderProfile();
      case "password":
        return renderPassword();
      case "review":
        return renderReview();
    }
  }

  if (success) {
    return (
      <div className="vj-wizard vj-stack">
        <div role="status" className="vj-alert vj-alert-success">
          <div>
            <p>
              <strong>{t("register.success.title")}</strong> {t("register.success.redirecting")}
            </p>
            {success.emailVerified === false ? (
              <p className="vj-hint">
                {t("register.success.verifyHint")}{" "}
                <a href="/verificar-email">{t("auth.verifyEmail")}</a>.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      className="vj-wizard vj-stack"
      ref={rootRef}
      onSubmit={onFormSubmit}
      noValidate
      aria-busy={pending || undefined}
    >
      <nav aria-label={t("register.progressNav")}>
        <p className="vj-hint" aria-live="polite">
          {interpolate(t("register.progress"), {
            current: stepIndex + 1,
            total: steps.length,
          })}
        </p>
        <ol className="vj-wizard-steps">
          {steps.map((id, index) => (
            <li
              key={id}
              data-state={index < stepIndex ? "done" : index === stepIndex ? "current" : "todo"}
              aria-current={index === stepIndex ? "step" : undefined}
            >
              <span className="vj-wizard-step-dot" aria-hidden="true">
                {index + 1}
              </span>
              <span className="vj-wizard-step-label">{t(STEP_TITLES[id])}</span>
            </li>
          ))}
        </ol>
      </nav>

      <div className="vj-stack">
        <div>
          <h2 className="vj-section-title" tabIndex={-1} ref={headingRef}>
            {t(STEP_TITLES[stepId])}
          </h2>
          <p className="vj-hint">{t(`register.stepIntro.${stepId}`)}</p>
        </div>

        {submitError ? (
          <p role="alert" className="vj-field-error">
            {submitError}
          </p>
        ) : null}

        {renderStep()}
      </div>

      <div className="vj-wizard-actions">
        {stepIndex > 0 ? (
          <Button type="button" variant="secondary" onClick={handleBack} disabled={pending}>
            {t("register.back")}
          </Button>
        ) : (
          <span />
        )}
        {isLast ? (
          <Button type="submit" loading={pending} loadingLabel={t("register.submitting")}>
            {t("register.submitFull")}
          </Button>
        ) : (
          <Button type="submit">{t("register.next")}</Button>
        )}
      </div>
    </form>
  );
}
