import { deepseek } from '@ai-sdk/deepseek';
import {
  customProvider,
  extractReasoningMiddleware,
  gateway,
  wrapLanguageModel,
} from "ai";
import { isTestEnvironment } from "../constants";

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        reasoningModel,
        titleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "chat-model-reasoning": reasoningModel,
          "title-model": titleModel,
          "artifact-model": artifactModel,
        },
      });
    })()
  : customProvider({
      languageModels: {
        "chat-model": deepseek("deepseek-chat"),
        "chat-model-reasoning": wrapLanguageModel({
          model: deepseek("deepseek-reasoner"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
        "title-model": deepseek("deepseek-chat"),
        "artifact-model": deepseek("deepseek-chat"),
      },
    });
