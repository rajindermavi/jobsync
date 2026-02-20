import { JobResponse } from "@/models/job.model";
import { AiProvider } from "@/models/ai.model";

// Re-export for backwards compatibility
export { convertResumeToText } from "@/lib/ai/tools/preprocessing";
export { convertJobToText } from "@/lib/ai/tools/preprocessing-job";

export interface ModelCheckResult {
  isRunning: boolean;
  error?: string;
  runningModelName?: string;
}

/**
 * Check if an Ollama model is installed and available
 * @param modelName - The name of the model to check
 * @param provider - The AI provider (only checks for Ollama)
 * @returns ModelCheckResult with isRunning status and optional error message
 */
export const checkIfModelIsRunning = async (
  modelName: string | undefined,
  provider: AiProvider,
): Promise<ModelCheckResult> => {
  // Only check for Ollama provider
  if (provider !== AiProvider.OLLAMA) {
    return { isRunning: true };
  }

  if (!modelName) {
    return {
      isRunning: false,
      error: "No model selected. Please select an AI model in settings first.",
    };
  }

  try {
    const response = await fetch("/api/ai/ollama/tags", {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return {
        isRunning: false,
        error:
          "Ollama service is not responding. Please make sure Ollama is running.",
      };
    }

    const data = await response.json();
    const installed = data.models ?? [];

    if (installed.length === 0) {
      return {
        isRunning: false,
        error: `No Ollama models installed. Pull one with: ollama pull ${modelName}`,
      };
    }

    const isInstalled = installed.some((m: any) => m.name === modelName);

    if (!isInstalled) {
      return {
        isRunning: false,
        error: `${modelName} is not installed. Run: ollama pull ${modelName}`,
      };
    }

    return { isRunning: true, runningModelName: modelName };
  } catch (error) {
    console.error("Error checking Ollama model:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return {
      isRunning: false,
      error: `Cannot connect to Ollama service. Error: ${errorMessage}`,
    };
  }
};

/**
 * Fetch list of all installed Ollama models
 * @returns Array of installed model names
 */
export const fetchRunningModels = async (): Promise<{
  models: string[];
  error?: string;
}> => {
  try {
    const response = await fetch("/api/ai/ollama/tags", {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return {
        models: [],
        error: "Failed to fetch Ollama models. Make sure Ollama is running.",
      };
    }

    const data = await response.json();
    const models = data.models?.map((m: any) => m.name) || [];
    return { models };
  } catch (error) {
    console.error("Error fetching Ollama models:", error);
    return {
      models: [],
      error: "Cannot connect to Ollama service.",
    };
  }
};
