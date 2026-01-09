import { generateObject, convertToModelMessages } from "ai";
import { z } from "zod";
import { myProvider } from "@/lib/ai/providers";
import type { ChatMessage } from "@/lib/types";
export const intentSchema = z.object({
  intent: z
    .enum(["resume_opt", "mock_interview", "related_topics", "others"])
    .describe("用户意图分类"),
  confidence: z.number().min(0).max(1).describe("置信度 0-1"),
  reason: z.string().describe("分类理由"),
});

export type IntentClassification = z.infer<typeof intentSchema>;

const CLASSIFY_SYSTEM_PROMPT = `你是一个互联网大公司的资深程序员和面试官，尤其擅长前端技术栈，包括 HTML、CSS、JavaScript、TypeScript、React、Vue、Node.js、小程序等技术。
请根据用户输入的内容，判断用户属于哪一种情况？

分类说明：
- resume_opt: 简历优化，用户想要优化、修改、完善自己的简历
- mock_interview: 模拟面试，用户想要进行面试练习或模拟面试
- related_topics: 和编程、面试、简历相关的话题，如技术问题、面试技巧等
- others: 其他与编程面试无关的话题

请仔细分析用户意图，输出对应的分类结果。`;

export async function classifyIntent(
  messages: ChatMessage[]
): Promise<IntentClassification> {
  const { object } = await generateObject({
    model: myProvider.languageModel("chat-model"),
    schema: intentSchema,
    system: CLASSIFY_SYSTEM_PROMPT,
    messages:convertToModelMessages(messages),
    maxOutputTokens: 256,
  });

  return object;
}
