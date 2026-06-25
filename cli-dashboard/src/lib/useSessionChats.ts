"use client";

import { useCallback, useEffect, useReducer } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  getChats,
  getDemoChats,
  isAuthenticated,
  type Chat,
  type SessionMap,
} from "@/lib/api";

type Status = "loading" | "refreshing" | "ready" | "error";

type State = {
  status: Status;
  chats: Chat[];
  sessionMap: SessionMap;
  error: string | null;
};

type Action =
  | { type: "load_start"; refresh: boolean }
  | { type: "load_success"; chats: Chat[]; sessionMap: SessionMap }
  | { type: "load_error"; error: string }
  | { type: "set_session_map"; sessionMap: SessionMap }
  | { type: "remove_chats"; raws: Chat[] };

const initialState: State = {
  status: "loading",
  chats: [],
  sessionMap: [],
  error: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "load_start":
      return { ...state, status: action.refresh ? "refreshing" : "loading", error: null };
    case "load_success":
      return { ...state, status: "ready", chats: action.chats, sessionMap: action.sessionMap };
    case "load_error":
      return { ...state, status: "error", error: action.error };
    case "set_session_map":
      return { ...state, sessionMap: action.sessionMap };
    case "remove_chats":
      return { ...state, chats: state.chats.filter((c) => !action.raws.includes(c)) };
    default:
      return state;
  }
}

/**
 * Owns the session's chat data: loading lifecycle, the session_map, and the
 * mutations the page applies to them (name/label edits, optimistic delete).
 */
export function useSessionChats(sessionId: string, isDemo: boolean) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, initialState);

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (!isDemo && !isAuthenticated()) {
        router.replace("/auth");
        return;
      }
      dispatch({ type: "load_start", refresh: mode === "refresh" });
      try {
        const force = mode === "refresh";
        const data = isDemo
          ? await getDemoChats(force, sessionId)
          : await getChats({ forceRefresh: force, sessionId });
        dispatch({ type: "load_success", chats: data.chats, sessionMap: data.sessionMap });
      } catch (err) {
        if (!isDemo && err instanceof ApiError && err.status === 401) {
          router.replace("/auth");
          return;
        }
        dispatch({
          type: "load_error",
          error: err instanceof ApiError ? err.message : "Failed to load chats.",
        });
      }
    },
    [isDemo, sessionId, router]
  );

  useEffect(() => {
    load("initial");
  }, [load]);

  const applySessionMap = useCallback(
    (sessionMap: SessionMap) => dispatch({ type: "set_session_map", sessionMap }),
    []
  );
  const removeChats = useCallback(
    (raws: Chat[]) => dispatch({ type: "remove_chats", raws }),
    []
  );

  return {
    chats: state.chats,
    sessionMap: state.sessionMap,
    error: state.error,
    loading: state.status === "loading",
    refreshing: state.status === "refreshing",
    reload: () => load("refresh"),
    applySessionMap,
    removeChats,
  };
}
