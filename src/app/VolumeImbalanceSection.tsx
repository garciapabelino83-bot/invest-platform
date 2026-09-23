type IconProps = { className?: string };

function IconBarChart({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 3v18h18" />
      <rect x="7" y="12" width="3" height="6" />
      <rect x="12.5" y="8" width="3" height="10" />
      <rect x="18" y="5" width="3" height="13" />
    </svg>
  );
}

function IconLock({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function IconInfo({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function IconArrowUpRight({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

function IconArrowDownRight({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M7 7 17 17" />
      <path d="M16 8v9H7" />
    </svg>
  );
}

interface VolumeImbalanceSectionProps {
  /**
   * true  -> usuario sin Plan Pro: contenido bloqueado con blur + candado + CTA hacia /pricing.
   * false -> usuario con Plan Pro activo (isPro): contenido completo y funcional.
   */
  locked: boolean;
}

export default function VolumeImbalanceSection({ locked }: VolumeImbalanceSectionProps) {
  return (
    <section className="bg-[#0a0a0b] border border-white/10 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
            <IconBarChart className="w-4 h-4 text-[#0ecb81]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Volume Imbalance (VI)</h3>
            <p className="text-[11px] text-neutral-500">Detección automática de desequilibrios de volumen</p>
          </div>
        </div>

        {locked ? (
          <span className="bg-[#0ecb81]/10 text-[#0ecb81] border border-[#0ecb81]/30 text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full">
            Plan Pro
          </span>
        ) : (
          <span className="flex items-center gap-1.5 bg-[#0ecb81]/10 text-[#0ecb81] border border-[#0ecb81]/30 text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0ecb81] animate-pulse" />
            Activo
          </span>
        )}
      </div>

      <div className="relative">
        <div
          className={locked ? "blur-[6px] select-none pointer-events-none" : undefined}
          aria-hidden={locked}
        >
          <VolumeImbalanceContent />
        </div>

        {locked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/75 backdrop-blur-[1px] px-6 text-center">
            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <IconLock className="w-5 h-5 text-neutral-300" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white">Función exclusiva del Plan Pro</p>
              <p className="text-xs text-neutral-400 leading-relaxed max-w-xs">
                Desbloquea la detección automática de zonas de Volume Imbalance, con sesgo largo y
                corto calculado en tiempo real.
              </p>
            </div>
            <a
              href="/pricing"
              className="bg-[#0ecb81] hover:opacity-90 text-black transition text-sm font-semibold px-5 py-2.5 rounded-lg inline-flex items-center justify-center"
            >
              Desbloquear Plan Pro — $9.99/mes
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

function VolumeImbalanceContent() {
  return (
    <div className="px-6 py-6 space-y-6">
      <div className="space-y-3">
        <p className="text-sm text-neutral-300 leading-relaxed">
          Un <span className="text-white font-semibold">Volume Imbalance (VI)</span> es el hueco
          que queda entre el cuerpo de una vela y el cuerpo de la vela siguiente, cuando ambas se
          mueven en la misma dirección. Solo se compara cuerpo contra cuerpo — las mechas no se
          toman en cuenta.
        </p>
        <div className="flex items-start gap-2.5 bg-white/5 border border-white/10 rounded-lg px-3.5 py-3">
          <IconInfo className="w-3.5 h-3.5 text-neutral-500 shrink-0 mt-0.5" />
          <p className="text-xs text-neutral-500 leading-relaxed">
            Es distinto al <span className="text-neutral-400 font-medium">Fair Value Gap (FVG)</span>,
            que se calcula usando las mechas (máximos y mínimos). El VI ignora las mechas por
            completo.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <ViDiagram direction="up" />
        <ViDiagram direction="down" />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <BiasCard
          direction="up"
          title="Sesgo Largo"
          description="El VI se formó durante un impulso alcista. Si el precio regresa a esa zona desde abajo, se interpreta como una zona de posible continuación al alza."
        />
        <BiasCard
          direction="down"
          title="Sesgo Corto"
          description="El VI se formó durante un impulso bajista. Si el precio regresa a esa zona desde arriba, se interpreta como una zona de posible continuación a la baja."
        />
      </div>
    </div>
  );
}

function ViDiagram({ direction }: { direction: "up" | "down" }) {
  const isUp = direction === "up";

  const candle1Class = isUp
    ? "w-8 h-10 rounded-sm bg-[#0ecb81] mb-[12px]"
    : "w-8 h-10 rounded-sm bg-[#f6465d] mb-[68px]";

  const candle2Class = isUp
    ? "w-8 h-10 rounded-sm bg-[#0ecb81] mb-[68px]"
    : "w-8 h-10 rounded-sm bg-[#f6465d] mb-[12px]";

  const zoneClass = isUp
    ? "absolute left-6 right-6 bottom-[52px] h-[16px] rounded-sm border border-dashed border-[#0ecb81]/50 bg-[#0ecb81]/10"
    : "absolute left-6 right-6 bottom-[52px] h-[16px] rounded-sm border border-dashed border-[#f6465d]/50 bg-[#f6465d]/10";

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500 mb-3">
        {isUp ? "VI alcista" : "VI bajista"}
      </p>

      <div className="relative h-[120px] flex items-end justify-center gap-10">
        <div className={candle1Class} />
        <div className={candle2Class} />
        <div className={zoneClass} />
      </div>

      <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-neutral-500">
        {isUp ? (
          <IconArrowUpRight className="w-3 h-3 text-[#0ecb81]" />
        ) : (
          <IconArrowDownRight className="w-3 h-3 text-[#f6465d]" />
        )}
        Zona de imbalance (cuerpo vs. cuerpo, sin mechas)
      </p>
    </div>
  );
}

function BiasCard({
  direction,
  title,
  description,
}: {
  direction: "up" | "down";
  title: string;
  description: string;
}) {
  const isUp = direction === "up";

  return (
    <div
      className={
        isUp
          ? "rounded-lg border border-[#0ecb81]/20 bg-[#0ecb81]/[0.04] px-4 py-3.5"
          : "rounded-lg border border-[#f6465d]/20 bg-[#f6465d]/[0.04] px-4 py-3.5"
      }
    >
      <div className="flex items-center gap-2 mb-1.5">
        {isUp ? (
          <IconArrowUpRight className="w-3.5 h-3.5 text-[#0ecb81]" />
        ) : (
          <IconArrowDownRight className="w-3.5 h-3.5 text-[#f6465d]" />
        )}
        <span
          className={
            isUp
              ? "text-xs font-semibold uppercase tracking-wide text-[#0ecb81]"
              : "text-xs font-semibold uppercase tracking-wide text-[#f6465d]"
          }
        >
          {title}
        </span>
      </div>
      <p className="text-xs text-neutral-400 leading-relaxed">{description}</p>
    </div>
  );
}
