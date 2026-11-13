"use client";

import { CSRF_HEADER } from "@verasjuris/security/constants";
import { ONBOARDING_PERSONA_META } from "@verasjuris/validation";
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
import type { ApiFailure } from "../lib/types";

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
  return [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
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
          onClick={onToggle}
        >
          {show ? "Ocultar" : "Mostrar"}
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

export function RegistrationWizard({ redirectTo }: { redirectTo?: string | null }) {
  const router = useRouter();
  const uid = useId();
  const [state, setState] = useState<WizardState>(INITIAL_WIZARD_STATE);
  const [errors, setErrors] = useState<WizardErrors>({});
  const [stepId, setStepId] = useState<WizardStepId>("persona");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<RegisterSuccess | null>(null);
  const [cepStatus, setCepStatus] = useState<CepStatus>("idle");
  const [cepMessage, setCepMessage] = useState<string | null>(null);
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

  useEffect(
    () => () => {
      cepAbortRef.current?.abort();
    },
    [],
  );

  // Move o foco ao mudar de etapa (ou ao primeiro campo inválido após tentar avançar).
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

  const setField = useCallback(
    <K extends keyof WizardState>(key: K, value: WizardState[K]) => {
      setState((current) => ({ ...current, [key]: value }));
      setErrors((current) => {
        if (!current[key]) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });
    },
    [],
  );

  async function lookupCep(rawCep: string) {
    const cep = digitsOnly(rawCep);
    if (!isValidCep(cep) || lastCepRef.current === cep) return;
    lastCepRef.current = cep;
    cepAbortRef.current?.abort();
    const controller = new AbortController();
    cepAbortRef.current = controller;
    setCepStatus("loading");
    setCepMessage(null);
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
        setCepMessage(
          data.error?.message ?? "Não foi possível consultar o CEP. Preencha o endereço manualmente.",
        );
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
      setCepMessage("Endereço preenchido a partir do CEP. Confira e informe o número.");
    } catch {
      if (controller.signal.aborted) return;
      setCepStatus("failed");
      setCepMessage("Não foi possível consultar o CEP. Preencha o endereço manualmente.");
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
        setCepMessage(null);
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
        const mapped = mapServerErrors(data.error?.details);
        setSubmitError(
          data.error?.message ??
            "Não foi possível criar a conta. Nenhum cadastro foi confirmado.",
        );
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
      setSubmitError(
        "Não foi possível confirmar a criação da conta. Verifique sua conexão e tente novamente.",
      );
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
        <div role="group" aria-labelledby={fid("persona-legend")}>
          <p id={fid("persona-legend")} className="vj-label">
            Como você usará a VerasJuris? *
          </p>
          <div className="vj-persona-grid">
            {PUBLIC_PERSONAS.map((persona: WizardPersona) => {
              const meta = ONBOARDING_PERSONA_META[persona];
              return (
                <button
                  key={persona}
                  type="button"
                  className="vj-persona-card"
                  aria-pressed={state.persona === persona}
                  aria-describedby={fid(`persona-${persona}`)}
                  onClick={() => setField("persona", persona)}
                >
                  <strong>{meta.label}</strong>
                  <span id={fid(`persona-${persona}`)}>{meta.description}</span>
                </button>
              );
            })}
          </div>
          {errors.persona ? (
            <p className="vj-field-error" role="alert">
              {errors.persona}
            </p>
          ) : null}
        </div>
        <p className="vj-hint" id={collaboratorId}>
          É colaborador de uma organização já cadastrada? O acesso de colaboradores é feito por
          convite. <a href="/convite">Acessar convite</a>.
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
          label={org ? "Nome completo do responsável" : "Nome completo"}
          value={state.fullName}
          onChange={(value) => setField("fullName", value)}
          error={errors.fullName}
          autoComplete="name"
          maxLength={120}
          required
        />
        <TextField
          id={fid("socialName")}
          label="Nome social (opcional)"
          value={state.socialName}
          onChange={(value) => setField("socialName", value)}
          error={errors.socialName}
          hint="Se informado, será usado para tratamento nas comunicações."
          autoComplete="nickname"
          maxLength={120}
        />
        <TextField
          id={fid("cpf")}
          label={org ? "CPF do responsável" : "CPF"}
          value={state.cpf}
          onChange={(value) => setField("cpf", maskCpf(value))}
          error={errors.cpf}
          inputMode="numeric"
          autoComplete="off"
          maxLength={14}
          placeholder="000.000.000-00"
          required
        />
        {personaNeedsBirthDate(state.persona) ? (
          <TextField
            id={fid("birthDate")}
            label="Data de nascimento"
            type="date"
            value={state.birthDate}
            onChange={(value) => setField("birthDate", value)}
            error={errors.birthDate}
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
          label="E-mail"
          type="email"
          value={state.email}
          onChange={(value) => setField("email", value)}
          error={errors.email}
          autoComplete="email"
          inputMode="email"
          maxLength={320}
          required
        />
        <FormField
          id={fid("phone")}
          label="Celular com DDD *"
          hint="Código do país +55 aplicado automaticamente."
          error={errors.phone}
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
    return (
      <div className="vj-stack">
        <TextField
          id={fid("postalCode")}
          label="CEP"
          value={state.postalCode}
          onChange={onCepChange}
          error={errors.postalCode}
          hint="Preenchemos o endereço automaticamente quando possível."
          autoComplete="postal-code"
          inputMode="numeric"
          maxLength={9}
          placeholder="00000-000"
          required
        />
        {cepStatus === "loading" ? (
          <p className="vj-hint" role="status">
            Consultando CEP…
          </p>
        ) : null}
        {cepMessage ? (
          <p
            className={cepStatus === "failed" ? "vj-field-error" : "vj-hint"}
            role={cepStatus === "failed" ? "alert" : "status"}
          >
            {cepMessage}
          </p>
        ) : null}
        <TextField
          id={fid("street")}
          label="Logradouro"
          value={state.street}
          onChange={(value) => setField("street", value)}
          error={errors.street}
          autoComplete="address-line1"
          maxLength={160}
          required
        />
        <div className="vj-wizard-row">
          <TextField
            id={fid("number")}
            label="Número"
            value={state.number}
            onChange={(value) => setField("number", value)}
            error={errors.number}
            autoComplete="off"
            maxLength={20}
            required
          />
          <TextField
            id={fid("complement")}
            label="Complemento (opcional)"
            value={state.complement}
            onChange={(value) => setField("complement", value)}
            error={errors.complement}
            autoComplete="address-line2"
            maxLength={80}
          />
        </div>
        <TextField
          id={fid("district")}
          label="Bairro"
          value={state.district}
          onChange={(value) => setField("district", value)}
          error={errors.district}
          autoComplete="address-level3"
          maxLength={80}
          required
        />
        <div className="vj-wizard-row">
          <TextField
            id={fid("city")}
            label="Cidade"
            value={state.city}
            onChange={(value) => setField("city", value)}
            error={errors.city}
            autoComplete="address-level2"
            maxLength={80}
            required
          />
          <FormField id={fid("state")} label="UF *" error={errors.state}>
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
              <option value="">Selecione</option>
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
              label={partner ? "Razão social ou nome da empresa (opcional)" : "Razão social"}
              value={state.organizationName}
              onChange={(value) => setField("organizationName", value)}
              error={errors.organizationName}
              autoComplete="organization"
              maxLength={120}
              required={!partner}
            />
            {isOrg ? (
              <TextField
                id={fid("tradeName")}
                label="Nome fantasia (opcional)"
                value={state.tradeName}
                onChange={(value) => setField("tradeName", value)}
                error={errors.tradeName}
                maxLength={120}
              />
            ) : null}
            <TextField
              id={fid("cnpj")}
              label={partner ? "CNPJ (opcional)" : "CNPJ"}
              value={state.cnpj}
              onChange={(value) => setField("cnpj", maskCnpj(value))}
              error={errors.cnpj}
              inputMode="numeric"
              autoComplete="off"
              maxLength={18}
              placeholder="00.000.000/0000-00"
              required={!partner}
            />
            {isOrg ? (
              <TextField
                id={fid("jobTitle")}
                label="Seu cargo (opcional)"
                value={state.jobTitle}
                onChange={(value) => setField("jobTitle", value)}
                error={errors.jobTitle}
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
                label="Número da OAB"
                value={state.oabNumber}
                onChange={(value) => setField("oabNumber", digitsOnly(value).slice(0, 20))}
                error={errors.oabNumber}
                inputMode="numeric"
                autoComplete="off"
                maxLength={20}
                required
              />
              <FormField id={fid("oabUf")} label="Seccional (UF) *" error={errors.oabUf}>
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
                  <option value="">Selecione</option>
                  {BR_STATES.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
            <p className="vj-hint">
              A inscrição na OAB é declaratória neste momento e será verificada depois, no fluxo de
              habilitação profissional. Nenhum selo de verificação é concedido no cadastro.
            </p>
            <FormField
              id={fid("practiceAreas")}
              label="Áreas de atuação (opcional)"
              error={errors.practiceAreas}
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
                aria-describedby={describedBy(fid("practiceAreas"), undefined, errors.practiceAreas)}
              />
            </FormField>
          </>
        ) : null}

        {partner ? (
          <>
            <FormField
              id={fid("partnerCategory")}
              label="Categoria de atuação *"
              error={errors.partnerCategory}
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
                <option value="">Selecione</option>
                {PARTNER_CATEGORIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              id={fid("partnerDescription")}
              label="Descrição dos serviços (opcional)"
              error={errors.partnerDescription}
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
    return (
      <div className="vj-stack">
        <PasswordInput
          id={fid("password")}
          label="Senha"
          value={state.password}
          onChange={(value) => setField("password", value)}
          error={errors.password}
          hint="Mínimo de 12 caracteres. Evite sequências e senhas comuns."
          autoComplete="new-password"
          show={showPassword}
          onToggle={() => setShowPassword((value) => !value)}
        />
        <div className="vj-password-meter" id={meterId} role="status" aria-live="polite">
          <div className="vj-password-meter-track" aria-hidden="true">
            <div className="vj-password-meter-bar" data-score={strength.score} />
          </div>
          <span>
            Força da senha: <strong>{strength.label}</strong>
            {state.password.length > 0 && state.password.length < 12
              ? ` · faltam ${12 - state.password.length} caracteres`
              : ""}
          </span>
        </div>
        {commonPassword ? (
          <p className="vj-field-error" role="status">
            Esta senha é muito comum e não será aceita. Escolha outra.
          </p>
        ) : null}
        <PasswordInput
          id={fid("passwordConfirm")}
          label="Confirmar senha"
          value={state.passwordConfirm}
          onChange={(value) => setField("passwordConfirm", value)}
          error={errors.passwordConfirm}
          autoComplete="new-password"
          show={showPassword}
          onToggle={() => setShowPassword((value) => !value)}
        />
        <p className="vj-hint">
          Sua senha não é armazenada no navegador e é enviada somente ao concluir o cadastro.
        </p>
      </div>
    );
  }

  function renderReview() {
    const persona = state.persona;
    const meta = persona ? ONBOARDING_PERSONA_META[persona] : null;
    const partnerLabel = PARTNER_CATEGORIES.find((item) => item.value === state.partnerCategory)?.label;
    const rows: Array<{ step: WizardStepId; title: string; items: Array<[string, string | undefined]> }> = [
      { step: "persona", title: "Perfil", items: [["Tipo de conta", meta?.label]] },
      {
        step: "identification",
        title: "Identificação",
        items: [
          ["Nome", state.fullName.trim()],
          ["Nome social", state.socialName.trim()],
          ["CPF", state.cpf],
          ["Nascimento", personaNeedsBirthDate(persona) ? state.birthDate : undefined],
        ],
      },
      {
        step: "contact",
        title: "Contato",
        items: [
          ["E-mail", state.email.trim()],
          ["Celular", state.phone ? `+55 ${state.phone}` : undefined],
        ],
      },
      {
        step: "address",
        title: "Endereço",
        items: [
          [
            "Endereço",
            `${state.street.trim()}, ${state.number.trim()}${state.complement.trim() ? ` – ${state.complement.trim()}` : ""}`,
          ],
          ["Bairro", state.district.trim()],
          ["Cidade/UF", `${state.city.trim()} / ${state.state.trim().toUpperCase()}`],
          ["CEP", state.postalCode],
        ],
      },
    ];
    if (steps.includes("profile")) {
      rows.push({
        step: "profile",
        title: "Dados profissionais",
        items: [
          ["Organização", state.organizationName.trim()],
          ["CNPJ", state.cnpj],
          ["OAB", personaNeedsOab(persona) ? `${state.oabNumber}/${state.oabUf}` : undefined],
          ["Categoria", partnerLabel],
        ],
      });
    }

    return (
      <div className="vj-stack">
        <div className="vj-stack" role="list" aria-label="Resumo do cadastro">
          {rows.map((row) => (
            <section key={row.step} className="vj-wizard-review" role="listitem">
              <div className="vj-wizard-review-head">
                <h3 className="vj-wizard-review-title">{row.title}</h3>
                <button
                  type="button"
                  className="vj-button vj-button-ghost"
                  onClick={() => goTo(row.step)}
                  aria-label={`Editar ${row.title}`}
                >
                  Editar
                </button>
              </div>
              <dl>
                {row.items.map(([label, value]) => (
                  <ReviewRow key={label} label={label} value={value} />
                ))}
              </dl>
            </section>
          ))}
        </div>

        <fieldset className="vj-wizard-fieldset">
          <legend className="vj-label">Termos e consentimentos</legend>
          <CheckField
            id={fid("acceptTerms")}
            checked={state.acceptTerms}
            onChange={(value) => setField("acceptTerms", value)}
            error={errors.acceptTerms}
          >
            Li e aceito os{" "}
            <a href="/politicas/termos" target="_blank" rel="noopener noreferrer">
              Termos de Uso
            </a>
            . *
          </CheckField>
          <CheckField
            id={fid("acceptPrivacy")}
            checked={state.acceptPrivacy}
            onChange={(value) => setField("acceptPrivacy", value)}
            error={errors.acceptPrivacy}
          >
            Li e aceito a{" "}
            <a href="/politicas/privacidade" target="_blank" rel="noopener noreferrer">
              Política de Privacidade
            </a>
            . *
          </CheckField>
          {isOrg ? (
            <CheckField
              id={fid("representationDeclaration")}
              checked={state.representationDeclaration}
              onChange={(value) => setField("representationDeclaration", value)}
              error={errors.representationDeclaration}
            >
              Declaro possuir poderes para representar a organização informada e aceitar estes
              termos em seu nome. *
            </CheckField>
          ) : null}
          <CheckField
            id={fid("acceptMarketing")}
            checked={state.acceptMarketing}
            onChange={(value) => setField("acceptMarketing", value)}
          >
            Desejo receber novidades e comunicações de marketing da VerasJuris (opcional).
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

  const stepIntro: Record<WizardStepId, string> = {
    persona: "Escolha o perfil que melhor descreve como você atuará na plataforma.",
    identification: "Use os dados oficiais. Eles são necessários para identificar sua conta.",
    contact: "Usaremos estes dados para comunicações essenciais da sua conta.",
    address: "Informe o endereço principal. Você pode ajustar os campos manualmente.",
    profile: "Informe os dados da organização ou da sua atuação profissional.",
    password: "Crie uma senha forte e exclusiva para a VerasJuris.",
    review: "Confira os dados e aceite os termos para criar sua conta.",
  };

  if (success) {
    return (
      <div className="vj-wizard vj-stack">
        <div role="status" className="vj-alert vj-alert-success">
          <div>
            <p>
              <strong>Conta criada com sucesso.</strong> Redirecionando para a plataforma…
            </p>
            {success.emailVerified === false ? (
              <p className="vj-hint">
                Seu e-mail ainda não foi verificado. Você poderá confirmá-lo depois em{" "}
                <a href="/verificar-email">Verificar e-mail</a>.
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
      <nav aria-label="Progresso do cadastro">
        <p className="vj-hint" aria-live="polite">
          Etapa {stepIndex + 1} de {steps.length}
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
              <span className="vj-wizard-step-label">{STEP_TITLES[id]}</span>
            </li>
          ))}
        </ol>
      </nav>

      <div className="vj-stack">
        <div>
          <h2 className="vj-section-title" tabIndex={-1} ref={headingRef}>
            {STEP_TITLES[stepId]}
          </h2>
          <p className="vj-hint">{stepIntro[stepId]}</p>
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
            Voltar
          </Button>
        ) : (
          <span />
        )}
        {isLast ? (
          <Button type="submit" loading={pending} loadingLabel="Criando conta…">
            Criar minha conta
          </Button>
        ) : (
          <Button type="submit">Avançar</Button>
        )}
      </div>
    </form>
  );
}
