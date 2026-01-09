import { tool } from "ai";
import { z } from "zod";
// scoreSkills tool: 对简历中技能进行评分
export const scoreSkillsTool = tool({
  description: "对简历中的专业技能进行评分，根据毕业时间和技能列表综合评估",
  inputSchema: z.object({
    graduationYear: z.number().describe("毕业年份，如 2020"),
    skills: z.array(z.string()).describe("技能列表，如 ['JavaScript', 'React', 'Node.js']"),
  }),
  execute: async ({ graduationYear, skills }) => {
    const currentYear = new Date().getFullYear();
    const yearsOfExperience = currentYear - graduationYear;
    const skillCount = skills.length;

    // 基础评分逻辑
    let score = 5;
    const suggestions: string[] = [];

    // 根据工作年限期望的技能数量
    const expectedSkillCount = Math.min(yearsOfExperience * 3 + 5, 20);

    // 技能数量评分
    if (skillCount >= expectedSkillCount) {
      score += 2;
    } else if (skillCount >= expectedSkillCount * 0.7) {
      score += 1;
      suggestions.push(`建议补充更多技能，${yearsOfExperience}年经验建议掌握${expectedSkillCount}项以上技能`);
    } else {
      suggestions.push(`技能数量偏少，${yearsOfExperience}年经验建议掌握${expectedSkillCount}项以上技能`);
    }

    // 检查核心技能覆盖
    const coreSkills = ["JavaScript", "TypeScript", "React", "Vue", "Node.js", "HTML", "CSS"];
    const hasCoreSkills = coreSkills.filter(cs =>
      skills.some(s => s.toLowerCase().includes(cs.toLowerCase()))
    );

    if (hasCoreSkills.length >= 5) {
      score += 2;
    } else if (hasCoreSkills.length >= 3) {
      score += 1;
      suggestions.push("建议补充更多核心前端技能（React/Vue/TypeScript等）");
    } else {
      suggestions.push("核心前端技能覆盖不足，建议补充 JavaScript、TypeScript、React/Vue 等");
    }

    // 检查进阶技能（根据工作年限）
    const advancedSkills = ["Webpack", "Vite", "性能优化", "微前端", "SSR", "GraphQL", "Docker", "CI/CD", "单元测试", "E2E测试"];
    const hasAdvancedSkills = advancedSkills.filter(as =>
      skills.some(s => s.toLowerCase().includes(as.toLowerCase()))
    );

    if (yearsOfExperience >= 3) {
      if (hasAdvancedSkills.length >= 3) {
        score += 1;
      } else {
        suggestions.push(`${yearsOfExperience}年经验应具备进阶技能，如工程化、性能优化、测试等`);
      }
    }

    // 确保分数在 5-10 范围内
    score = Math.max(5, Math.min(10, score));

    const suggestion = suggestions.length > 0
      ? suggestions.join("；")
      : "技能覆盖全面，与工作年限匹配良好";

    return { score, suggestion };
  },
});