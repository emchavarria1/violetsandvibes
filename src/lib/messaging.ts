import { supabase } from "@/lib/supabase";

/**
 * For now: 1:1 conversations.
 * Returns an existing conversation id if both users are members of the same convo,
 * otherwise creates a new conversation + both membership rows.
 */
export async function getOrCreateDirectConversation(myId: string, otherUserId: string) {
  if (!myId || !otherUserId) {
    throw new Error("Both user IDs are required.");
  }

  if (myId === otherUserId) {
    throw new Error("You cannot start a conversation with yourself.");
  }

  // 1) Try to find an existing convo shared by both users
  const { data: shared, error: sharedError } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", myId);

  if (sharedError) throw sharedError;

  const convoIds = (shared ?? []).map((r: any) => r.conversation_id);
  if (convoIds.length > 0) {
    const { data: otherMember, error: otherError } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .in("conversation_id", convoIds)
      .eq("user_id", otherUserId)
      .limit(1)
      .maybeSingle();

    if (otherError) throw otherError;
    if (otherMember?.conversation_id) return otherMember.conversation_id as string;
  }

  // 2) Create a new conversation
  const { data: convo, error: convoError } = await supabase
    .from("conversations")
    .insert({ created_by: myId })
    .select("id")
    .single();

  if (convoError) throw convoError;

  const conversationId = convo.id as string;

  // 3) Add both members (insert self first for stricter RLS setups)
  const { error: meMemberError } = await supabase
    .from("conversation_members")
    .insert({ conversation_id: conversationId, user_id: myId });
  if (meMemberError) throw meMemberError;

  const { error: otherMemberError } = await supabase
    .from("conversation_members")
    .insert({ conversation_id: conversationId, user_id: otherUserId });
  if (otherMemberError) throw otherMemberError;

  return conversationId;
}

export async function getOrCreateCircleConversation(circleName: string) {
  const trimmedName = circleName.trim();
  if (!trimmedName) {
    throw new Error("Circle name is required.");
  }

  const { data, error } = await supabase.rpc("get_or_create_circle_conversation", {
    p_circle_name: trimmedName,
  });

  if (error) throw error;
  if (!data) {
    throw new Error("Could not open the circle chat.");
  }

  return data as string;
}
