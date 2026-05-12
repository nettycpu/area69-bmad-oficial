class PromptSafetyService
  # Modos:
  #   standard (default) — permite adulto consentido, bloqueia categorias criticas
  #   strict            — bloqueia qualquer NSFW adulto
  #   off               — apenas em development/test; em production vira standard
  SAFETY_MODE = ENV.fetch("PROMPT_SAFETY_MODE", "standard")

  # ── Menores / underage ──────────────────────────────────────────────────
  UNDERAGE_PATTERNS = [
    /\b(crianc[ae]|menor(es)?|infantil|adolescente)\b/i,
    /\b(child|children|minor|underage)\b/i,
  ].freeze

  # ── Nao consensual / coerção ────────────────────────────────────────────
  NON_CONSENSUAL_PATTERNS = [
    /\b(sem\s+consentimento|non\s*consensual|forced|force\s+\w+|asleep|unconscious|drunk|drugged)\b/i,
    /\b(c[aâ]mera\s+escondida|hidden\s+camera|spycam)\b/i,
    /\b(revenge\s*porn|vazado|leaked|secretly)\b/i,
  ].freeze

  # ── Deepfake sexual / identidade real ───────────────────────────────────
  DEEPFAKE_PATTERNS = [
    /\b(deepfake\s*(porn|sexual|nude)|face\s*swap\s*sexual)\b/i,
    /\b(celebrity\s*nude|famosa\s+nua|ex\s+namorada\s+nua)\b/i,
    /\b(pessoa\s+real\s+nua\s+sem\s+consentimento|usar\s+rosto\s+real\s+em\s+nudez)\b/i,
  ].freeze

  # ── Undress / deepnude / remocao de roupa ───────────────────────────────
  UNDRESS_PATTERNS = [
    /\b(remov[aeio]\s+(a\s+)?roup[aeio]|tir[aeio]\s+(a\s+)?roup[aeio]|deix[aeio]r?\s+nua)\b/i,
    /\b(remover\s+(biqu[ií]ni|lingerie)|remov[aoe]\s+(bikini|lingerie|clothes?))\b/i,
    /\b(undress|deepnude|nudeify|strip\s+clothes)\b/i,
    /\b(make\s+(her|him)\s+naked)\b/i,
  ].freeze

  # ── Violencia sexual ────────────────────────────────────────────────────
  VIOLENCE_PATTERNS = [
    /\b(estupro|rape|sexual\s*assault|forced\s*sex|abuso\s*sexual)\b/i,
  ].freeze

  # ── Combinacoes perigosas (teen + nude, schoolgirl + nude, etc) ─────────
  DANGEROUS_COMBINATIONS = [
    [/\b(teen|adolescent|schoolgirl|colegial)\b/i, /\b(n(u[uú]|dism?|de|s?))\b/i],
    [/\b(1[3-7]\s*anos)\b/i,                        /\b(sex|nu[oa]|pelad[oa])\b/i],
  ].freeze

  class SafetyError < StandardError; end

  def self.check!(prompt)
    mode = resolve_mode
    return true if mode == "off"

    prompt_lower = prompt.to_s.downcase

    check_patterns!(prompt_lower, UNDERAGE_PATTERNS, mode)
    check_patterns!(prompt_lower, NON_CONSENSUAL_PATTERNS, mode)
    check_patterns!(prompt_lower, DEEPFAKE_PATTERNS, mode)
    check_patterns!(prompt_lower, UNDRESS_PATTERNS, mode)
    check_patterns!(prompt_lower, VIOLENCE_PATTERNS, mode)
    check_combinations!(prompt_lower)

    if mode == "strict"
      strict_block_patterns = [
        /\b(n(u[uú]|dism?|de)\b|pelad[ao]|sem\s*roup[aeio])/i,
      ]
      check_patterns!(prompt_lower, strict_block_patterns, mode)
    end

    true
  end

  def self.check_patterns!(prompt_lower, patterns, mode)
    patterns.each do |pattern|
      if prompt_lower.match?(pattern)
        raise SafetyError, error_message(mode)
      end
    end
  end

  def self.check_combinations!(prompt_lower)
    DANGEROUS_COMBINATIONS.each do |pattern_a, pattern_b|
      if prompt_lower.match?(pattern_a) && prompt_lower.match?(pattern_b)
        raise SafetyError, error_message
      end
    end
  end

  def self.resolve_mode
    return "off" if %w[off].include?(SAFETY_MODE) && (Rails.env.development? || Rails.env.test?)
    return "strict" if SAFETY_MODE == "strict"
    "standard"
  end

  def self.error_message(mode = "standard")
    "Esse tipo de edicao nao e permitido. Use conteudo adulto consentido e seguro."
  end
end
