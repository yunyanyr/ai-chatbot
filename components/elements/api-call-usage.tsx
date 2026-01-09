"use client";

import type { ComponentProps } from "react";
import { useEffect, useRef } from "react";
import useSWR, { useSWRConfig }  from "swr";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "next-auth/react";
import { Progress } from "@/components/ui/progress";
import type { ChatMessage } from "@/lib/types";
import type { UseChatHelpers } from "@ai-sdk/react";
import type { ApiCallsUsage } from "@/lib/types";
import { fetcher } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ContextIcon } from "./context";

export type ApiCallUsageProps = ComponentProps<"button">& {
  /** Chat status from useChat hook, used to trigger data refresh */
  status?: UseChatHelpers<ChatMessage>["status"];
};

export const ApiCallUsage = ({ className, status, ...props }: ApiCallUsageProps) => {
   const { data: session } = useSession();
  const { data: apiCallsUsage,isLoading,error } = useSWR<ApiCallsUsage>(session?.user ? "/api/chat/usage" : null,fetcher);
 const { mutate } = useSWRConfig();
  useEffect(() => {
    if (status === "streaming" && session?.user) {
      mutate("/api/chat/usage" );
    }
  }, [status,mutate,session?.user]);

  const used = apiCallsUsage?.used ?? 0;
  const max = apiCallsUsage?.max ?? 10;
  const userType = apiCallsUsage?.userType ?? "guest";
  const usedPercent = Math.min(100, (used / max) * 100);
  // Don't render if no session or error loading
  if (!session?.user || error) {
    return null;
  }

  // Show loading state
  if (isLoading) {
    return (
      <button
        className={cn(
          "inline-flex select-none items-center gap-1 rounded-md text-sm",
          "cursor-pointer bg-background text-foreground",
          "outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className
        )}
        disabled
        type="button"
        {...props}
      >
        <ContextIcon percent={0} />
      </button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "inline-flex select-none items-center gap-1 rounded-md text-sm",
            "cursor-pointer bg-background text-foreground",
            "outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            className
          )}
          type="button"
          {...props}
        >
          <span className="font-medium text-muted-foreground text-xs">
            {used}/{max}
          </span>
          <ContextIcon percent={usedPercent} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-fit p-3" side="top">
        <div className="min-w-[200px] space-y-2">
          <div className="flex items-start justify-between text-sm">
            <span>今日调用</span>
            <span className="text-muted-foreground">
              {used} / {max} 次
            </span>
          </div>
          <div className="space-y-2">
            <Progress className="h-2 bg-muted" value={usedPercent} />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {userType === "guest" ? (
              <span>访客每天可调用 {max} 次，注册后可获得更多次数</span>
            ) : (
              <span>注册用户每天可调用 {max} 次</span>
            )}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
