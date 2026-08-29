"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { submitEnrollment } from "@/lib/actions/enrollment";

export function EnrollmentForm({
  slug,
  teams,
}: {
  slug: string;
  teams: { name: string; categories: string[] }[];
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState("");
  const availableCategories = teams.find((t) => t.name === selectedTeam)?.categories ?? [];

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await submitEnrollment(formData);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div>
        <h2 className="text-[24px] mb-1 font-display">Matrícula enviada! ✅</h2>
        <p className="text-[13.5px] text-ink-soft m-0">
          O clube vai analisar os dados e entrar em contato pelo e-mail ou telefone informado.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-[26px] mb-0.5 font-display">Matrícula</h2>
        <p className="text-[13.5px] text-ink-soft m-0">
          Preencha os dados do atleta e do responsável. O clube revisa antes de confirmar.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input type="hidden" name="slug" value={slug} />
        {/* Campo-armadilha: fora da tela, invisível pra humano, tentador pra bot. */}
        <div
          aria-hidden="true"
          className="absolute -left-[9999px] w-px h-px overflow-hidden"
        >
          <label htmlFor="website">Não preencha este campo</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        <Field label="Nome completo do atleta">
          <Input name="fullName" required placeholder="Nome do atleta" autoComplete="name" />
        </Field>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Data de nascimento">
            <Input name="birthDate" type="date" required />
          </Field>
          <Field label="Sexo">
            <select
              name="sex"
              defaultValue=""
              className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
            >
              <option value="">Prefiro não informar</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
            </select>
          </Field>
        </div>

        {teams.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Time pretendido">
              <select
                name="team"
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
              >
                <option value="">Não sei / a definir</option>
                {teams.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Categoria">
              <select
                key={selectedTeam}
                name="category"
                defaultValue=""
                disabled={!selectedTeam || availableCategories.length === 0}
                className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm disabled:opacity-50"
              >
                <option value="">
                  {selectedTeam ? "Não sei / a definir" : "Escolha o time primeiro"}
                </option>
                {availableCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}

        <Field label="Nome do responsável">
          <Input name="guardianName" required placeholder="Nome de quem responde pelo atleta" />
        </Field>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="CPF do responsável">
            <Input name="guardianCpf" required placeholder="000.000.000-00" />
          </Field>
          <Field label="Celular do responsável">
            <Input name="guardianPhone" type="tel" placeholder="(83) 99999-0000" />
          </Field>
        </div>
        <Field label="E-mail do responsável">
          <Input name="guardianEmail" type="email" required placeholder="voce@email.com" />
        </Field>
        <Field label="Instagram do atleta (opcional)">
          <Input name="instagram" placeholder="@usuario" />
        </Field>

        <label className="flex items-start gap-2 text-[12.5px] text-ink-soft mt-1">
          <input type="checkbox" name="consent" required className="mt-0.5" />
          <span>
            Autorizo o tratamento dos dados acima pelo clube, conforme a LGPD, para fins de
            avaliação e eventual matrícula.
          </span>
        </label>

        {error && <p className="text-clay text-[13px] font-medium m-0">{error}</p>}

        <Button variant="solid" size="md" type="submit" disabled={pending}>
          {pending ? "Enviando…" : "Enviar matrícula"}
        </Button>
      </form>
    </div>
  );
}
