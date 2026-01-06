/* eslint-disable no-unused-vars */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";

import PostCard from "@/features/profile/components/PostCard";
import PostModal from "@/features/profile/components/PostModal";

import {
  fetchPosts,
  fetchMe,
  likePost,
  commentOnPost,
  deleteComment,
} from "@/api/authApi";

import { baseApi } from "../../../api";

const INITIAL_CHUNK = 30;
const SUBSEQUENT_CHUNK = 10;
const FALLBACK_AVATAR =
  "https://i.postimg.cc/fRVdFSbg/e1ef6545-86db-4c0b-af84-36a726924e74.png";
const TEXT_UNKNOWN_USER =
  "\u0985\u099C\u09BE\u09A8\u09BE \u09AC\u09CD\u09AF\u09AC\u09B9\u09BE\u09B0\u0995\u09BE\u09B0\u09C0";
const TEXT_UNKNOWN_AUTHOR =
  "\u0985\u09A8\u09BE\u09AE\u09BE \u09B2\u09C7\u0996\u0995";
const TEXT_ANONYMOUS_LIKE_PREFIX =
  "\u0985\u099C\u09BE\u09A8\u09BE \u09AA\u09B8\u09A8\u09CD\u09A6";
const TEXT_ANONYMOUS_COMMENT_PREFIX =
  "\u0985\u099C\u09BE\u09A8\u09BE \u09AE\u09A8\u09CD\u09A4\u09AC\u09CD\u09AF\u0995\u09BE\u09B0\u09C0";

const ensureAbsoluteUrl = (url) => {
  if (!url) return null;
  if (url.startsWith("http") || url.startsWith("blob:")) return url;
  return `${baseApi}${url}`;
};

const resolveId = (entity) => {
  if (entity == null) return null;
  if (typeof entity === "string" || typeof entity === "number") {
    return entity;
  }
  return entity._id ?? entity.id ?? entity.userId ?? entity.username ?? null;
};

const sameId = (left, right) => {
  if (left == null || right == null) return false;
  return String(left).toLowerCase() === String(right).toLowerCase();
};

const adaptUser = (user, fallbackName = TEXT_UNKNOWN_USER) => {
  if (!user || typeof user !== "object") {
    return {
      id: fallbackName,
      name: fallbackName,
      username: undefined,
      avatar: FALLBACK_AVATAR,
    };
  }

  const identifier = resolveId(user) ?? user.username ?? fallbackName;
  const avatarSource =
    ensureAbsoluteUrl(user.profileImage) ??
    ensureAbsoluteUrl(user.avatar) ??
    FALLBACK_AVATAR;

  return {
    id: identifier,
    name: user.name ?? user.username ?? fallbackName,
    username: user.username,
    avatar: avatarSource,
  };
};

const adaptFeedPost = (rawPost, viewerId) => {
  const postId =
    resolveId(rawPost) ?? rawPost?._id ?? rawPost?.id ?? `post-${Date.now()}`;
  const author = adaptUser(
    rawPost?.user ?? rawPost?.author ?? {},
    TEXT_UNKNOWN_AUTHOR
  );

  const coerceMediaSrc = (candidate) => {
    if (!candidate) return null;
    if (typeof candidate === "string") return candidate;
    if (typeof candidate === "object") {
      if (typeof candidate.url === "string") return candidate.url;
      if (typeof candidate.src === "string") return candidate.src;
      if (typeof candidate.path === "string") return candidate.path;
    }
    return null;
  };

  // --- VIDEO HANDLING FIX ---
  const videoCandidates = [
    ...(Array.isArray(rawPost?.videos) ? rawPost.videos : []),
    rawPost?.video,
    rawPost?.media?.video,
  ];

  // Extract all valid video sources
  const videoSources = videoCandidates
    .map(coerceMediaSrc)
    .filter((item) => typeof item === "string" && item.trim().length > 0)
    .map((src) => ensureAbsoluteUrl(src))
    .filter(Boolean);

  // --- IMAGE HANDLING ---
  const imageCandidates = [
    ...(Array.isArray(rawPost?.images) ? rawPost.images : []),
    rawPost?.image,
    rawPost?.mediaUrl,
    rawPost?.media,
    rawPost?.coverPhoto,
    ...(Array.isArray(rawPost?.media?.images) ? rawPost.media.images : []),
    ...(Array.isArray(rawPost?.mediaFiles) ? rawPost.mediaFiles : []),
  ];

  const imageSources = imageCandidates
    .map(coerceMediaSrc)
    .filter((value) => typeof value === "string" && value.trim().length > 0);

  const uniqueImages = [];
  for (const src of imageSources) {
    const absolute = ensureAbsoluteUrl(src);
    if (absolute && !uniqueImages.includes(absolute)) {
      uniqueImages.push(absolute);
    }
  }

  // --- CONSOLIDATED MEDIA GALLERY (Multiple Videos + Images) ---
  const mediaGallery = [
    ...videoSources.map((src) => ({ type: "video", src })),
    ...uniqueImages.map((src) => ({ type: "image", src })),
  ].slice(0, 10); // Limit to 10 items

  // Determine main media for the card view
  let media = mediaGallery.length > 0 ? mediaGallery[0] : null;

  // Prefer first video as main media if available
  if (videoSources.length > 0) {
    media = { type: "video", src: videoSources[0] };
  }

  const likeEntries = Array.isArray(rawPost?.likes) ? rawPost.likes : [];
  const likedUsers = likeEntries.map((entry, index) =>
    adaptUser(
      typeof entry === "object"
        ? entry
        : { id: entry, username: String(entry) },
      `${TEXT_ANONYMOUS_LIKE_PREFIX} ${index + 1}`
    )
  );

  const liked = viewerId
    ? likedUsers.some((user) => {
        const identifier = resolveId(user) ?? user.username;
        return identifier ? sameId(identifier, viewerId) : false;
      })
    : false;

  const comments = Array.isArray(rawPost?.comments)
    ? rawPost.comments.map((comment, index) => {
        const authorInfo = adaptUser(
          comment?.user ?? comment?.author ?? {},
          `${TEXT_ANONYMOUS_COMMENT_PREFIX} ${index + 1}`
        );
        return {
          id: comment._id?.toString() || comment.id?.toString(),
          _id: comment._id?.toString() || comment.id?.toString(),
          text: comment?.text ?? comment?.content ?? "",
          createdAt:
            comment?.createdAt ?? comment?.date ?? new Date().toISOString(),
          author: authorInfo,
        };
      })
    : [];

  return {
    id: postId,
    content:
      rawPost?.text ??
      rawPost?.content ??
      rawPost?.caption ??
      rawPost?.description ??
      "",
    createdAt: rawPost?.createdAt ?? new Date().toISOString(),
    media,
    mediaGallery,
    likes: likedUsers.length,
    liked,
    likedUsers,
    comments,
    author,
    raw: rawPost,
  };
};

export default function InfiniteFeed() {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const loaderRef = useRef(null);

  const [currentUser, setCurrentUser] = useState(null);
  const [activePostId, setActivePostId] = useState(null);
  const [activeModalMode, setActiveModalMode] = useState("comments");
  const [activePostStartIndex, setActivePostStartIndex] = useState(0);
  const [deletingCommentId, setDeletingCommentId] = useState(null);

  const currentUserId = useMemo(() => resolveId(currentUser), [currentUser]);
  const viewerIdentity = useMemo(
    () => adaptUser(currentUser ?? {}, "আপনি"),
    [currentUser]
  );

  const getChunkSize = useCallback(
    (pageNumber) => (pageNumber === 1 ? INITIAL_CHUNK : SUBSEQUENT_CHUNK),
    []
  );

  const getSliceWindow = useCallback(
    (pageNumber) => {
      if (pageNumber === 1) {
        const initialSize = getChunkSize(1);
        return { start: 0, end: initialSize };
      }
      const start = INITIAL_CHUNK + (pageNumber - 2) * SUBSEQUENT_CHUNK;
      const end = start + getChunkSize(pageNumber);
      return { start, end };
    },
    [getChunkSize]
  );

  const loadPosts = useCallback(async () => {
    if (isLoadingPosts || !hasMore) return;
    setIsLoadingPosts(true);
    try {
      const response = await fetchPosts();
      const allPosts = response?.posts ?? [];
      const { start, end } = getSliceWindow(page);
      const nextChunk = allPosts.slice(start, end);

      if (!nextChunk.length) {
        setHasMore(false);
        return;
      }

      const mapped = nextChunk.map((item) =>
        adaptFeedPost(item, currentUserId ?? null)
      );
      setPosts((prev) => {
        const map = new Map();
        prev.forEach((p) => map.set(String(p.id), p));
        mapped.forEach((p) => {
          const key = String(p.id);
          if (!map.has(key)) map.set(key, p);
        });
        return Array.from(map.values());
      });
      if (nextChunk.length < getChunkSize(page)) {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Failed to load posts", error);
      toast.error("পোস্ট লোড করা যায়নি");
    } finally {
      setIsLoadingPosts(false);
    }
  }, [
    currentUserId,
    getChunkSize,
    getSliceWindow,
    hasMore,
    isLoadingPosts,
    page,
  ]);

  useEffect(() => {
    if (hasMore) {
      loadPosts();
    }
  }, [loadPosts, hasMore]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && hasMore && !isLoadingPosts) {
          setPage((prev) => prev + 1);
        }
      },
      { threshold: 0.1, rootMargin: "200px" }
    );

    const current = loaderRef.current;
    if (current) observer.observe(current);

    return () => {
      if (current) observer.unobserve(current);
    };
  }, [hasMore, isLoadingPosts]);

  useEffect(() => {
    let ignore = false;
    const loadCurrentUser = async () => {
      try {
        const response = await fetchMe();
        if (ignore) return;
        setCurrentUser(response?.data ?? response ?? null);
      } catch (error) {
        console.error("Failed to load current user", error);
      }
    };
    loadCurrentUser();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    setPosts((prev) =>
      prev.map((post) => {
        if (!post?.raw) return post;
        const remapped = adaptFeedPost(post.raw, currentUserId);
        return { ...remapped, raw: post.raw };
      })
    );
  }, [currentUserId]);

  const handleToggleLike = useCallback(
    async (postId) => {
      setPosts((prev) =>
        prev.map((post) => {
          if (!sameId(post.id, postId)) return post;

          const viewerKey = viewerIdentity?.id
            ? String(viewerIdentity.id).toLowerCase()
            : null;
          const existingLikedUsers = Array.isArray(post.likedUsers)
            ? post.likedUsers
            : [];

          const hasViewer = viewerKey
            ? existingLikedUsers.some((user) => {
                const identifier = resolveId(user) ?? user.username;
                return identifier ? sameId(identifier, viewerKey) : false;
              })
            : false;

          let updatedLikedUsers = existingLikedUsers;
          let liked = post.liked;

          if (hasViewer) {
            updatedLikedUsers = existingLikedUsers.filter((user) => {
              const identifier = resolveId(user) ?? user.username;
              return identifier ? !sameId(identifier, viewerKey) : true;
            });
            liked = false;
          } else {
            if (viewerKey) {
              updatedLikedUsers = [...existingLikedUsers, viewerIdentity];
              liked = true;
            }
          }

          const updatedRaw = post.raw
            ? {
                ...post.raw,
                likes: liked
                  ? [...(post.raw.likes ?? []), viewerIdentity]
                  : (post.raw.likes ?? []).filter((entry) => {
                      const identifier =
                        resolveId(entry) ?? entry?.username ?? entry;
                      return identifier ? !sameId(identifier, viewerKey) : true;
                    }),
              }
            : post.raw;

          return {
            ...post,
            liked,
            likes: updatedLikedUsers.length,
            likedUsers: updatedLikedUsers,
            raw: updatedRaw,
          };
        })
      );

      try {
        await likePost(postId);
      } catch (error) {
        console.error("Failed to toggle like", error);
        toast.error("লাইক পরিবর্তন করা যায়নি");
      }
    },
    [viewerIdentity]
  );

  const handleAddComment = useCallback(
    async (postId, text) => {
      if (!text.trim()) return;
      try {
        const response = await commentOnPost(postId, text);
        const payload = response?.data ?? {
          text,
          createdAt: new Date().toISOString(),
          user: currentUser,
        };
        const normalizedAuthor = adaptUser(
          payload?.user ?? currentUser ?? {},
          "আপনি"
        );
        const commentId =
          resolveId(payload) ??
          payload?._id ??
          payload?.id ??
          payload?.commentId ??
          `comment-${Date.now()}`;

        const newComment = {
          id: commentId,
          text: payload?.text ?? text,
          createdAt: payload?.createdAt ?? new Date().toISOString(),
          author: normalizedAuthor,
        };

        setPosts((prev) =>
          prev.map((post) => {
            if (!sameId(post.id, postId)) return post;
            const updatedRaw = post.raw
              ? {
                  ...post.raw,
                  comments: [
                    ...(post.raw.comments ?? []),
                    payload ?? newComment,
                  ],
                }
              : post.raw;
            return {
              ...post,
              comments: [...post.comments, newComment],
              raw: updatedRaw,
            };
          })
        );
        toast.success("মন্তব্য যোগ হয়েছে");
      } catch (error) {
        console.error("Failed to add comment", error);
        toast.error("মন্তব্য যোগ করা যায়নি");
      }
    },
    [currentUser]
  );

  const handleDeleteComment = useCallback(async (postId, commentId) => {
    if (!postId || !commentId) return;
    setDeletingCommentId(commentId);
    try {
      await deleteComment(postId, commentId);
      setPosts((prev) =>
        prev.map((post) => {
          if (!sameId(post.id, postId)) return post;
          const filtered = post.comments.filter(
            (comment) => (comment._id || comment.id) !== commentId
          );
          const updatedRaw = post.raw
            ? {
                ...post.raw,
                comments: (post.raw.comments ?? []).filter(
                  (c) => (c._id || c.id) !== commentId
                ),
              }
            : post.raw;
          return { ...post, comments: filtered, raw: updatedRaw };
        })
      );
      toast.success("মন্তব্য মুছে ফেলা হয়েছে");
    } catch (error) {
      console.error("Failed to delete comment", error);
      toast.error("মন্তব্য মুছে ফেলা যায়নি");
    } finally {
      setDeletingCommentId(null);
    }
  }, []);

  const openCommentsModal = useCallback((postId, startIndex = 0) => {
    setActiveModalMode("comments");
    setActivePostStartIndex(Number.isFinite(startIndex) ? startIndex : 0);
    setActivePostId(postId);
  }, []);

  const openLikesModal = useCallback((postId) => {
    setActiveModalMode("likes");
    setActivePostStartIndex(0);
    setActivePostId(postId);
  }, []);

  const closeModal = useCallback(() => {
    setActivePostId(null);
    setActiveModalMode("comments");
    setActivePostStartIndex(0);
    setDeletingCommentId(null);
  }, []);

  const handleDeletePost = useCallback(
    (postId) => {
      setPosts((prev) => prev.filter((p) => !sameId(p.id, postId)));
      if (sameId(activePostId, postId)) {
        setActivePostId(null);
      }
      toast.success("পোস্ট মুছে ফেলা হয়েছে");
    },
    [activePostId]
  );

  const activePost = useMemo(
    () => posts.find((post) => sameId(post.id, activePostId)) ?? null,
    [posts, activePostId]
  );

  const canDeleteComment = useCallback(
    (comment) => {
      const commentAuthorId = resolveId(comment?.author);
      return currentUserId && commentAuthorId
        ? sameId(commentAuthorId, currentUserId)
        : false;
    },
    [currentUserId]
  );

  return (
    <div className="feed">
      {posts.map((post) => {
        const isOwner = currentUserId
          ? sameId(post.author?.id, currentUserId)
          : false;
        return (
          <PostCard
            key={post.id}
            post={post}
            isOwner={isOwner}
            onDelete={() => handleDeletePost(post.id)}
            onLike={() => handleToggleLike(post.id)}
            onOpenLikes={() => openLikesModal(post.id)}
            onOpenComments={() => openCommentsModal(post.id)}
            onAddComment={handleAddComment}
            onOpenPost={openCommentsModal}
          />
        );
      })}

      {hasMore && (
        <div
          ref={loaderRef}
          style={{ height: "40px" }}
        />
      )}

      <PostModal
        open={Boolean(activePost)}
        post={activePost}
        mode={activeModalMode}
        startIndex={activePostStartIndex}
        onClose={closeModal}
        onToggleLike={handleToggleLike}
        onAddComment={handleAddComment}
        onDeleteComment={handleDeleteComment}
        canDeleteComment={canDeleteComment}
      />
    </div>
  );
}
