import { Injectable } from '@nestjs/common';

export interface AiLeadScore {
  score: number;           // 0-100
  priority: 'hot' | 'warm' | 'cold';
  signals: string[];
  recommendation: string;
}

/**
 * AiService — AI-powered lead scoring and recommendations.
 * Phase 1: rule-based heuristics (no external API required).
 * Phase 2: OpenAI / Claude integration for natural language summaries.
 */
@Injectable()
export class AiService {

  /**
   * Score a lead based on available signals:
   * - source type (referral = hot)
   * - stage recency (stale = cold)
   * - activity frequency
   * - property interest match
   */
  scoreLead(lead: {
    stage: string;
    sourceType?: string | null;
    stageChangedAt: Date;
    activityCount: number;
    hasProperty: boolean;
    daysSinceLastActivity: number;
  }): AiLeadScore {
    let score = 50;
    const signals: string[] = [];

    // Source signals
    if (lead.sourceType === 'REFERRAL') {
      score += 20;
      signals.push('Рекомендація — висока якість ліда');
    } else if (lead.sourceType === 'WEBSITE') {
      score += 10;
      signals.push('Прийшов із сайту — цілеспрямований інтерес');
    } else if (lead.sourceType === 'FB_LEAD_ADS') {
      score -= 5;
      signals.push('Facebook Lead Ads — потребує кваліфікації');
    }

    // Stage signals
    if (lead.stage === 'NEGOTIATION') { score += 25; signals.push('У переговорах'); }
    else if (lead.stage === 'SHOWING') { score += 15; signals.push('Дійшов до показу'); }
    else if (lead.stage === 'QUALIFIED') { score += 10; signals.push('Кваліфікований'); }
    else if (lead.stage === 'WON' || lead.stage === 'LOST') { score = 0; }

    // Activity signals
    if (lead.activityCount >= 5) { score += 10; signals.push('Висока залученість (5+ активностей)'); }
    else if (lead.activityCount === 0) { score -= 15; signals.push('Немає активностей'); }

    // Recency signals
    if (lead.daysSinceLastActivity > 14) {
      score -= 20;
      signals.push(`Не було активності ${lead.daysSinceLastActivity} днів`);
    } else if (lead.daysSinceLastActivity > 7) {
      score -= 10;
      signals.push('Активність понад тиждень тому');
    }

    // Property interest
    if (lead.hasProperty) { score += 5; signals.push(`Є інтерес до конкретного об'єкта`); }

    score = Math.max(0, Math.min(100, score));

    const priority: 'hot' | 'warm' | 'cold' =
      score >= 70 ? 'hot' : score >= 40 ? 'warm' : 'cold';

    const recommendation =
      priority === 'hot'
        ? 'Пріоритет! Зателефонуйте сьогодні та запропонуйте зустріч'
        : priority === 'warm'
        ? 'Надішліть WhatsApp з новими пропозиціями'
        : lead.daysSinceLastActivity > 14
        ? 'Перевірте лід — можливо, варто закрити як програний'
        : 'Продовжуйте комунікацію, поки клієнт ще теплий';

    return { score, priority, signals, recommendation };
  }

  /**
   * Generate a brief AI summary of lead status.
   * In Phase 2 this will call Claude/OpenAI with activity history.
   */
  summarizeLead(lead: {
    clientName: string;
    stage: string;
    activityCount: number;
    lastActivity?: string | null;
    property?: string | null;
  }): string {
    const stageMap: Record<string, string> = {
      NEW: 'новий лід', CONTACTED: 'налагоджено контакт', QUALIFIED: 'кваліфікований',
      SHOWING: 'показ проведено', NEGOTIATION: 'у переговорах', WON: 'угода закрита', LOST: 'програно',
    };
    const stageText = stageMap[lead.stage] ?? lead.stage;
    const propText = lead.property ? `, зацікавлений об'єктом «${lead.property}»` : '';
    const actText = lead.activityCount > 0
      ? `, ${lead.activityCount} взаємодій`
      : ', без активностей';
    return `${lead.clientName} — ${stageText}${propText}${actText}.`;
  }
}
