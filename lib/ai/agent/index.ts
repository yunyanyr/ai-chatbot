import { createUIMessageStream } from "ai";
import { unstable_cache as cache } from "next/cache";
import { after } from "next/server";
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from "resumable-stream";
import type { ModelCatalog } from "tokenlens/core";
import { fetchModels } from "tokenlens/fetch";
import type { Session } from "next-auth";
import type { ChatModel } from "@/lib/ai/models";
import type { RequestHints } from "@/lib/ai/prompts";
import {
  createStreamId,
  saveMessages,
  updateChatLastContextById,
} from "@/lib/db/queries";
import type { ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { generateUUID } from "@/lib/utils";
import { classifyIntent } from "@/lib/ai/agent/classify";
import { createResumeOptStream } from "@/lib/ai/agent/resume-opt";
import { createMockInterviewStream } from "@/lib/ai/agent/mock-interview";
import { createDefaultStream } from "@/lib/ai/agent/common";

let globalStreamContext: ResumableStreamContext | null = null;

export const getTokenlensCatalog = cache(
  async (): Promise<ModelCatalog | undefined> => {
    try {
      return await fetchModels();
    } catch (err) {
      console.warn(
        "TokenLens: catalog fetch failed, using default catalog",
        err
      );
      return; // tokenlens helpers will fall back to defaultCatalog
    }
  },
  ["tokenlens-catalog"],
  { revalidate: 24 * 60 * 60 } // 24 hours
);

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes("REDIS_URL")) {
        console.log(
          " > Resumable streams are disabled due to missing REDIS_URL"
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

export type CreateChatStreamParams = {
  chatId: string;
  uiMessages: ChatMessage[];
  selectedChatModel: ChatModel["id"];
  requestHints: RequestHints;
  session: Session;
};

export async function createChatStream({
  chatId,
  uiMessages,
  selectedChatModel,
  requestHints,
  session,
}: CreateChatStreamParams) {
  const streamId = generateUUID();
  await createStreamId({ streamId, chatId });

  let finalMergedUsage: AppUsage | undefined;
  
  const stream = createUIMessageStream({
    execute: async ({ writer: dataStream }) => {
      // 意图分类
      const classification = await classifyIntent(uiMessages);
      console.log('classfi',classification);
      let result;
      // 简历优化
      if (classification.intent === "resume_opt") {
        result = createResumeOptStream({
          messages: uiMessages,
          dataStream,
          onUsageUpdate: (usage) => {
            finalMergedUsage = usage;
          },
        });

      }else if (classification.intent === "mock_interview") {
        //模拟面试
        result = createMockInterviewStream(uiMessages);

      }else{
        // 其他情况执行原有逻辑
        result = createDefaultStream({
          selectedChatModel,
          requestHints,
          uiMessages,
          session,
          dataStream,
          onUsageUpdate: (usage) => {
            finalMergedUsage = usage;
          },
        });
      }

      result.consumeStream();
      dataStream.merge(
        result.toUIMessageStream({
          sendReasoning: true,
        })
      );
    },
    generateId: generateUUID,
    onFinish: async ({ messages }) => {
      await saveMessages({
        messages: messages.map((currentMessage) => ({
          id: currentMessage.id,
          role: currentMessage.role,
          parts: currentMessage.parts,
          createdAt: new Date(),
          attachments: [],
          chatId,
        })),
      });

      if (finalMergedUsage) {
        try {
          await updateChatLastContextById({
            chatId,
            context: finalMergedUsage,
          });
        } catch (err) {
          console.warn("Unable to persist last usage for chat", chatId, err);
        }
      }
    },
    onError: () => {
      return "Oops, an error occurred!";
    },
  });

  return { stream, streamId };
}
