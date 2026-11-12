"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// ✏️ Change these to your own details
const NAME = "Kristian Dino Barruga";
const NETWORK = "Makati Science Institute of the Philippines";
const CITY = "Manila City";

const MAX = 280;

type Post = {
  id: string;
  user_id: string | null;
  name: string | null;
  body: string;
  created_at: string;
};

function timeAgo(iso: string, now: number) {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function Wall() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [photoOk, setPhotoOk] = useState(true);

  // An anonymous "user id" that is saved in this browser
  useEffect(() => {
    let id = localStorage.getItem("wall-user-id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("wall-user-id", id);
    }
    setUserId(id);
    setName(localStorage.getItem("wall-name") ?? "");
  }, []);

  // A clock, so "5m" / "2h" labels stay fresh
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Load the latest 50 posts, then listen for new ones (Realtime)
  useEffect(() => {
    if (!supabase) return;
    const db = supabase;

    db.from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) setMessage("Could not load posts.");
        else setPosts(data as Post[]);
      });

    const channel = db
      .channel("posts-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        (payload) => {
          const post = payload.new as Post;
          setPosts((prev) =>
            prev.some((p) => p.id === post.id)
              ? prev
              : [post, ...prev].slice(0, 50)
          );
        }
      )
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, []);

  async function share() {
    const body = text.trim();
    const author = name.trim();
    if (!body || !author || !supabase || sending) return;

    setSending(true);
    setMessage("");
    const { data, error } = await supabase
      .from("posts")
      .insert({ body, name: author, user_id: userId })
      .select()
      .single();
    setSending(false);

    if (error) {
      setMessage("Could not share your post. Please try again.");
      return;
    }
    setText("");
    setPosts((prev) =>
      prev.some((p) => p.id === data.id) ? prev : [data as Post, ...prev]
    );
  }

  return (
    <div
      className="min-h-screen bg-white text-[13px] text-[#333]"
      style={{
        fontFamily: "'Lucida Grande', Tahoma, Verdana, Arial, sans-serif",
      }}
    >
      {/* Top bar */}
      <div className="bg-[#3b5998] px-4 py-2 text-xl font-bold text-white">
        wall
      </div>

      <div className="mx-auto flex max-w-4xl flex-col gap-6 p-4 md:flex-row">
        {/* Left column: profile */}
        <aside className="w-full shrink-0 md:w-56">
          {photoOk ? (
            // Put your own photo in the "public" folder and name it profile.jpg
            <img
              src="/profile.jpg"
              alt={NAME}
              onError={() => setPhotoOk(false)}
              className="aspect-[3/4] w-full border border-[#ccc] object-cover"
            />
          ) : (
            <div className="flex aspect-[3/4] w-full items-center justify-center bg-[#d8dfea] text-7xl font-bold text-[#3b5998]">
              {NAME.charAt(0)}
            </div>
          )}
          <h1 className="mt-3 text-base font-bold">{NAME}</h1>
          <p className="text-[#777]">wall</p>

          <div className="mt-4 border-t-2 border-[#d8dfea] bg-[#f7f7f7] px-2 py-1 font-bold text-[#555]">
            Information
          </div>
          <dl className="mt-2 space-y-2 px-1 text-xs">
            <div>
              <dt className="text-[#777]">Networks:</dt>
              <dd>{NETWORK}</dd>
            </div>
            <div>
              <dt className="text-[#777]">Current City:</dt>
              <dd>{CITY}</dd>
            </div>
          </dl>
        </aside>

        {/* Right column: share box and feed */}
        <main className="min-w-0 flex-1">
          {!supabase && (
            <p className="mb-3 border border-red-300 bg-red-50 p-2 text-red-700">
              Supabase keys are missing. Add NEXT_PUBLIC_SUPABASE_URL and
              NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart the app.
            </p>
          )}

          <div className="rounded border border-[#bbb] bg-[#f2f2f2] p-3">
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                localStorage.setItem("wall-name", e.target.value);
              }}
              maxLength={40}
              placeholder="Your name"
              className="mb-2 w-full border border-[#bdc7d8] bg-white p-2 outline-none focus:border-[#3b5998]"
            />
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={MAX}
              rows={3}
              placeholder="What's on your mind?"
              className="w-full resize-none border border-[#bdc7d8] bg-white p-2 outline-none focus:border-[#3b5998]"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-[#777]">
                {MAX - text.length} characters remaining
              </span>
              <button
                onClick={share}
                disabled={!text.trim() || !name.trim() || sending || !supabase}
                className="border border-[#29447e] bg-[#5b74a8] px-4 py-1 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? "Sharing..." : "Share"}
              </button>
            </div>
          </div>

          {message && <p className="mt-2 text-red-700">{message}</p>}

          <ul className="mt-4">
            {posts.map((post) => (
              <li key={post.id} className="border-b border-[#e5e5e5] py-3">
                <div className="flex justify-between">
                  <span className="font-bold text-[#3b5998]">
                    {post.name || NAME}
                  </span>
                  <span className="text-xs text-[#999]">
                    {now !== null ? timeAgo(post.created_at, now) : ""}
                  </span>
                </div>
                <p className="mt-1 break-words whitespace-pre-wrap">
                  {post.body}
                </p>
              </li>
            ))}
            {posts.length === 0 && supabase && (
              <li className="py-6 text-center text-[#999]">
                No posts yet. Be the first to share something!
              </li>
            )}
          </ul>
        </main>
      </div>
    </div>
  );
}
