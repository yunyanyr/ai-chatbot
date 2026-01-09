import {
  convertToModelMessages,
  smoothStream,
  stepCountIs,
  streamText,
} from "ai";
import type { Session } from "next-auth";
import type { UIMessageStreamWriter, LanguageModelUsage } from "ai";
import type { ChatModel } from "@/lib/ai/models";
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import { myProvider } from "@/lib/ai/providers";
import { createDocument } from "@/lib/ai/tools/create-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { isProductionEnvironment } from "@/lib/constants";
import type { ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { getUsage } from "tokenlens/helpers";
import { getTokenlensCatalog } from "./index";

export type OnUsageUpdateFn = (usage: AppUsage) => void;

export type HandleFinishParams = {
  usage: LanguageModelUsage;
  selectedChatModel: ChatModel["id"];
  dataStream: UIMessageStreamWriter;
  onUsageUpdate: OnUsageUpdateFn;
};

export async function handleStreamFinish({
  usage,
  selectedChatModel,
  dataStream,
  onUsageUpdate,
}: HandleFinishParams) {
  try {
    const providers = await getTokenlensCatalog();
    const modelId = myProvider.languageModel(selectedChatModel).modelId;
    if (!modelId) {
      onUsageUpdate(usage as AppUsage);
      dataStream.write({
        type: "data-usage",
        data: usage,
      });
      return;
    }

    if (!providers) {
      onUsageUpdate(usage as AppUsage);
      dataStream.write({
        type: "data-usage",
        data: usage,
      });
      return;
    }

    const summary = getUsage({ modelId, usage, providers });
    const mergedUsage = { ...usage, ...summary, modelId } as AppUsage;
    onUsageUpdate(mergedUsage);
    dataStream.write({ type: "data-usage", data: mergedUsage });
  } catch (err) {
    console.warn("TokenLens enrichment failed", err);
    onUsageUpdate(usage as AppUsage);
    dataStream.write({ type: "data-usage", data: usage });
  }
}

export type DefaultStreamParams = {
  selectedChatModel: ChatModel["id"];
  requestHints: RequestHints;
  uiMessages: ChatMessage[];
  session: Session;
  dataStream: UIMessageStreamWriter;
  onUsageUpdate: (usage: AppUsage) => void;
};

export function createDefaultStream({
  selectedChatModel,
  requestHints,
  uiMessages,
  session,
  dataStream,
  onUsageUpdate,
}: DefaultStreamParams) {
  return streamText({
    model: myProvider.languageModel(selectedChatModel),
    system: systemPrompt({ selectedChatModel, requestHints }),
    messages: convertToModelMessages(uiMessages),
    stopWhen: stepCountIs(5),
    maxOutputTokens: 200,
    experimental_activeTools:
      selectedChatModel === "chat-model-reasoning"
        ? []
        : [
            // "getWeather",
            // "createDocument",
            // "updateDocument",
            // "requestSuggestions",
          ],
    experimental_transform: smoothStream({ chunking: "word" }),
    tools: {
      // getWeather,
      // createDocument: createDocument({ session, dataStream }),
      // updateDocument: updateDocument({ session, dataStream }),
      // requestSuggestions: requestSuggestions({
      //   session,
      //   dataStream,
      // }),
    },
    experimental_telemetry: {
      isEnabled: isProductionEnvironment,
      functionId: "stream-text",
    },
    onFinish: async ({ usage }) => {
      await handleStreamFinish({
        usage,
        selectedChatModel,
        dataStream,
        onUsageUpdate,
      });
    },
  });
}
