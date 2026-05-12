class PromptSafetyService
  BLOCKED_PATTERNS = [
    /\b(remov[aeio]|tir[aeio]|elimin[aeio])\s.*(roup[aeio]|vestid[ao]|calcinha|cueca|suti[aã]|bikini|mai[oô])\b/i,
    /\b(roup[aeio]|vestid[ao])\s.*(remov[aeio]|tir[aeio])\b/i,
    /\b(undress|naked|nude|without\s*clothes)\b/i,
    /\b(n[uú]|n[uú]a|n[uú]dismo)\b/i,
    /\b(deix[aeio]|fic[aeio])\s.*(n[uú][aao]|sem\s*roup[aeio])\b/i,
    /\b(sexual|sexo|explicit[oa]|porn[oó]|er[oó]tic[oa])\b/i,
    /\b(menor|menin[ao]|crian[cç]a|adolescente)\s.*(n[uú][aao]|sexual|pelad[ao])\b/i,
    /\b(deepfake|n[ãa]o\s*consensual|v[ií]deo\s*[íi]ntimo)\b/i,
    /\b(viol[eê]ncia\s*sexual|estupro|abuso\s*sexual)\b/i,
  ].freeze

  class SafetyError < StandardError; end

  def self.check!(prompt)
    prompt_lower = prompt.to_s.downcase

    BLOCKED_PATTERNS.each do |pattern|
      if prompt_lower.match?(pattern)
        raise SafetyError, "Esse tipo de edicao nao e permitido. Use prompts seguros e consentidos."
      end
    end

    true
  end
end
