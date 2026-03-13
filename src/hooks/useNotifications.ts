import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

type NotificationRow = {
  id: string;
  recipient_id: string;
  read_at: string | null;
  created_at: string;
};

export function useNotifications() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchUnread = async () => {
    if (!user) return;

    setLoading(true);
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .is("read_at", null);

    if (!error) setUnreadCount(count ?? 0);
    else console.error("fetchUnread error:", error);

    setLoading(false);
  };

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    fetchUnread();

    const channel = supabase
      .channel("vv-unread-dot")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          const row = (payload as any).new as NotificationRow;
          if (!row) return;
          void fetchUnread();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          const rowNew = (payload as any).new as NotificationRow;
          if (!rowNew) return;
          void fetchUnread();
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "notifications" },
        (payload) => {
          const rowOld = (payload as any).old as NotificationRow | undefined;
          if (rowOld?.recipient_id && rowOld.recipient_id !== user.id) return;
          void fetchUnread();
        }
      )
      .subscribe((status) => {
        // optional debug
        // console.log("vv-unread-dot status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return { unreadCount, loading, refreshUnread: fetchUnread };
}
