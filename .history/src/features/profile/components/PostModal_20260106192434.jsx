import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { NavLink } from "react-router-dom";
import { format } from "timeago.js";
import DeleteOutlineIcon from "@/assets/IconComponents/DeleteOutlineIcon";
import { LiquedLoader } from "@/components/loaders";
import Modal from "./Modal";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { useModalVideoController } from "@/hooks/useVideoVisibility";
import ExpandableText from "@/components/ui/ExpandableText";

// --- ICONS ---
const SendIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg">
    <path
      d="M22 2L11 13"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M22 2L15 22L11 13L2 9L22 2Z"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// --- CONSTANTS ---
const LIKES_CHUNK = 12;
const TEXT_LOADING = "\u09B2\u09CB\u09A1 \u09B9\u099A\u09CD\u099B\u09C7...";
const TEXT_LIKE_TOGGLE_ACTIVE =
  "\u09B2\u09BE\u0987\u0995 \u0995\u09B0\u09BE \u09B9\u09DF\u09C7\u099B\u09C7";
const TEXT_LIKE_TOGGLE_INACTIVE = "\u09B2\u09BE\u0987\u0995";
const TEXT_LIKES_LABEL = "\u09B2\u09BE\u0987\u0995";
const TEXT_COMMENTS_LABEL = "\u09AE\u09A8\u09CD\u09A4\u09AC\u09CD\u09AF";
const TEXT_NO_LIKES =
  "\u098F\u0996\u09A8\u0993 \u0995\u09CB\u09A8\u09CB \u09B2\u09BE\u0987\u0995 \u09A8\u09C7\u0987";
const TEXT_NO_COMMENTS =
  "\u098F\u0996\u09A8\u0993 \u0995\u09CB\u09A8\u09CB \u09AE\u09A8\u09CD\u09A4\u09AC\u09CD\u09AF \u09A8\u09C7\u0987";
const TEXT_COMMENT_PLACEHOLDER =
  "\u09AE\u09A8\u09CD\u09A4\u09AC\u09CD\u09AF \u09B2\u09BF\u0996\u09C1\u09A8...";
const TEXT_SUBMIT_BTN_LABEL = "পোস্ট";
const TEXT_DELETE_COMMENT_ARIA =
  "\u09AE\u09A8\u09CD\u09A4\u09AC\u09CD\u09AF \u09AE\u09C1\u099B\u09C1\u09A8";
const TEXT_LIKES_LOADING =
  "\u09B2\u09BE\u0987\u0995 \u09A4\u09A5\u09CD\u09AF \u09B2\u09CB\u09A1 \u09B9\u099A\u09CD\u099B\u09C7...";
const TEXT_UNKNOWN_USER =
  "\u0985\u099C\u09BE\u09A8\u09BE \u09AC\u09CD\u09AF\u09AC\u09B9\u09BE\u09B0\u0995\u09BE\u09B0\u09C0";
const TEXT_MEDIA_ALT =
  "\u09AA\u09CB\u09B8\u09CD\u099F\u09C7\u09B0 \u099B\u09AC\u09BF";
const CLOSE_SYMBOL = "\u00D7";

// --- BANGLA TIME HELPER ---
const formatTimeAgoBangla = (dateString) => {
  try {
    const timeStr = format(dateString);
    return timeStr
      .replace("just now", "এইমাত্র")
      .replace("right now", "এইমাত্র")
      .replace(/(\d+)\s+seconds? ago/, "$1 সেকেন্ড আগে")
      .replace(/(\d+)\s+minutes? ago/, "$1 মিনিট আগে")
      .replace(/(\d+)\s+hours? ago/, "$1 ঘণ্টা আগে")
      .replace(/(\d+)\s+days? ago/, "$1 দিন আগে")
      .replace(/(\d+)\s+weeks? ago/, "$1 সপ্তাহ আগে")
      .replace(/(\d+)\s+months? ago/, "$1 মাস আগে")
      .replace(/(\d+)\s+years? ago/, "$1 বছর আগে")
      .replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[d]);
  } catch (e) {
    return "";
  }
};

const buildProfilePath = (user) => {
  if (!user || typeof user !== "object") return null;
  const rawIdent =
    user.username ??
    user.userName ??
    user.handle ??
    user._id ??
    user.id ??
    user.userId ??
    null;
  if (!rawIdent) return null;
  const trimmed = String(rawIdent).trim();
  if (!trimmed) return null;
  return `/user/${user.id}`;
};

export default function PostModal({
  open,
  post,
  mode,
  onClose,
  onToggleLike,
  onAddComment,
  onDeleteComment,
  canDeleteComment,
  initialSlideIndex = 0,
}) {
  const [commentText, setCommentText] = useState("");
  const [visibleLikes, setVisibleLikes] = useState([]);
  const [likesCursor, setLikesCursor] = useState(0);
  const [likesLoading, setLikesLoading] = useState(false);
  const [activeMode, setActiveMode] = useState(mode ?? "comments");

  // --- NEW: Dynamic Height State ---
  // This state will store the height of the CURRENT active slide
  const [carouselHeight, setCarouselHeight] = useState("auto");

  useModalVideoController(open);
  const likesScrollRef = useRef(null);
  const likesThrottleRef = useRef(false);
  const likesTimerRef = useRef(null);
  const textareaRef = useRef(null);

  const autoplayPlugin = useMemo(
    () => Autoplay({ delay: 4000, playOnInit: false, stopOnInteraction: true }),
    []
  );

  const likedUsers = useMemo(
    () => (Array.isArray(post?.likedUsers) ? post.likedUsers : []),
    [post]
  );
  const isLikesMode = activeMode === "likes";

  const slides = useMemo(() => {
    if (!post) return [];
    if (Array.isArray(post.mediaGallery) && post.mediaGallery.length > 0) {
      return post.mediaGallery.filter((item) => item && item.src);
    }
    const singleMedia = post.media;
    if (singleMedia && singleMedia.src) return [singleMedia];
    return [];
  }, [post]);

  const useCarousel = slides.length > 1;

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      align: "center",
      containScroll: "trimSnaps",
      loop: useCarousel,
      startIndex: initialSlideIndex,
    },
    useCarousel ? [autoplayPlugin] : []
  );

  // --- DYNAMIC HEIGHT LOGIC ---
  // This function measures the current image height and resizes the wrapper
  useEffect(() => {
    if (!emblaApi) return;

    const updateHeight = () => {
      const slides = emblaApi.slideNodes();
      const index = emblaApi.selectedScrollSnap();
      const currentSlide = slides[index];

      if (currentSlide) {
        // Measure the height of the slide's content
        const height = currentSlide.getBoundingClientRect().height;
        if (height > 0) {
          setCarouselHeight(`${height}px`);
        }
      }
    };

    emblaApi.on("init", updateHeight);
    emblaApi.on("select", updateHeight);
    emblaApi.on("reInit", updateHeight);

    // Observer to detect when image finishes loading and changes size
    const resizeObserver = new ResizeObserver(() => {
      // Debounce slightly or just call update
      requestAnimationFrame(updateHeight);
    });

    emblaApi.slideNodes().forEach((slide) => resizeObserver.observe(slide));

    return () => {
      resizeObserver.disconnect();
      emblaApi.off("init", updateHeight);
      emblaApi.off("select", updateHeight);
      emblaApi.off("reInit", updateHeight);
    };
  }, [emblaApi, open]);

  useEffect(() => {
    if (open && emblaApi) {
      emblaApi.reInit();
      emblaApi.scrollTo(initialSlideIndex, true);
    }
  }, [open, emblaApi, initialSlideIndex, slides]);

  useEffect(() => {
    if (!open) return;
    setActiveMode(mode ?? "comments");
  }, [mode, open]);

  useEffect(() => {
    if (open && activeMode !== "likes") setCommentText("");
  }, [open, activeMode, post?.id]);

  useEffect(() => {
    if (!open || !post || !isLikesMode) {
      setVisibleLikes([]);
      setLikesCursor(0);
      setLikesLoading(false);
      return;
    }
    const initialCursor = Math.min(LIKES_CHUNK, likedUsers.length);
    setVisibleLikes(likedUsers.slice(0, initialCursor));
    setLikesCursor(initialCursor);
    setLikesLoading(false);
  }, [open, post, likedUsers, isLikesMode]);

  useEffect(() => {
    return () => {
      if (likesTimerRef.current) clearTimeout(likesTimerRef.current);
      likesThrottleRef.current = false;
    };
  }, []);

  // --- Auto-resize Textarea ---
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        100
      )}px`;
    }
  }, [commentText]);

  const loadMoreLikes = useCallback(() => {
    if (!isLikesMode || likesLoading) return;
    if (likesCursor >= likedUsers.length) return;
    setLikesLoading(true);
    const nextCursor = Math.min(likesCursor + LIKES_CHUNK, likedUsers.length);
    const nextItems = likedUsers.slice(likesCursor, nextCursor);
    likesTimerRef.current = setTimeout(() => {
      setVisibleLikes((prev) => [...prev, ...nextItems]);
      setLikesCursor(nextCursor);
      setLikesLoading(false);
      likesTimerRef.current = null;
    }, 200);
  }, [isLikesMode, likesLoading, likesCursor, likedUsers]);

  const handleLikesScroll = useCallback(
    (event) => {
      if (!isLikesMode || likesLoading) return;
      const target = event.currentTarget;
      const { scrollTop, clientHeight, scrollHeight } = target;
      if (scrollHeight - (scrollTop + clientHeight) <= 32) {
        if (likesThrottleRef.current) return;
        likesThrottleRef.current = true;
        loadMoreLikes();
        setTimeout(() => {
          likesThrottleRef.current = false;
        }, 180);
      }
    },
    [isLikesMode, likesLoading, loadMoreLikes]
  );

  const handleSubmitComment = useCallback(() => {
    const value = commentText.trim();
    if (!value || !post) return;
    onAddComment?.(post.id, value);
    setCommentText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [commentText, onAddComment, post]);

  const likesContent = useMemo(() => {
    if (!post) return [];
    if (visibleLikes.length === 0 && !likesLoading)
      return <div className="empty-state">{TEXT_NO_LIKES}</div>;
    const fallbackAvatar =
      post.author?.avatar || "https://i.pravatar.cc/80?u=post-like";
    return visibleLikes.map((user, index) => {
      const key = user?.id ?? user?.username ?? `like-${index}`;
      const avatar = user?.avatar || fallbackAvatar;
      const displayName = user?.name || user?.username || TEXT_UNKNOWN_USER;
      const profilePath = buildProfilePath(user);
      const Wrapper = profilePath ? NavLink : "div";
      const wrapperProps = profilePath
        ? { to: profilePath, className: "post-likes-item" }
        : { className: "post-likes-item" };
      return (
        <Wrapper
          key={key}
          {...wrapperProps}>
          <img
            src={avatar}
            alt={displayName}
            className="post-likes-avatar"
          />
          <div className="post-likes-meta">
            <span className="post-likes-name">{displayName}</span>
            {user?.username && (
              <span className="post-likes-username">@{user.username}</span>
            )}
          </div>
        </Wrapper>
      );
    });
  }, [visibleLikes, likesLoading, post]);

  if (!post)
    return (
      <Modal
        open={open}
        onClose={onClose}
        size="md"
        className="post-modal post-modal--top"
        backdropZIndex={2000}
        backdropStyle={{ padding: 0, alignItems: "flex-start" }}>
        <div className="modal-loader-container">
          <LiquedLoader label={TEXT_LOADING} />
        </div>
      </Modal>
    );

  const likeToggleLabel = post.liked
    ? TEXT_LIKE_TOGGLE_ACTIVE
    : TEXT_LIKE_TOGGLE_INACTIVE;
  const likeCountLabel = `${post.likes ?? 0} ${TEXT_LIKES_LABEL}`;
  const commentCountLabel = `${post.comments.length} ${TEXT_COMMENTS_LABEL}`;

  const header = (
    <div
      className="ka-modal-header"
      style={{ gap: "0.75rem" }}>
      <div style={{ display: "flex", gap: "0.65rem", alignItems: "center" }}>
        <img
          src={post.author.avatar}
          alt={post.author.name}
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            objectFit: "cover",
          }}
        />
        <div>
          <div style={{ fontWeight: 600, color: "#ffffffff" }}>
            {post.author.name}
          </div>
          <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
            {formatTimeAgoBangla(post.createdAt)}
          </div>
        </div>
      </div>
      <button
        type="button"
        className="ka-modal-close"
        aria-label="Close"
        onClick={onClose}>
        {CLOSE_SYMBOL}
      </button>
    </div>
  );

  const setCommentsMode = () => setActiveMode("comments");
  const setLikesMode = () => setActiveMode("likes");

  return (
    <Modal
      open={open}
      onClose={onClose}
      header={header}
      size="xl"
      className="post-modal post-modal--top"
      backdropZIndex={2000}
      backdropStyle={{ padding: 0, alignItems: "flex-start" }}>
      <div className="post-modal-content">
        <style>{`
          /* GLOBAL STYLES */
          .post-modal-content, 
          .comment-list, 
          .post-likes-list,
          .post-modal-comments {
            scrollbar-width: none; 
            -ms-overflow-style: none;
          }
          .post-modal-content::-webkit-scrollbar, 
          .comment-list::-webkit-scrollbar, 
          .post-likes-list::-webkit-scrollbar,
          .post-modal-comments::-webkit-scrollbar {
            display: none;
          }

          /* DESKTOP MEDIA */
          .post-modal-media {
            padding: 0 !important;
            margin: 0 !important;
            background-color: transparent !important;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100% !important;
          }
          
          .post-modal-media img, 
          .post-modal-media video {
            width: 100% !important;
            object-fit: contain;
            display: block;
            margin: 0 auto;
          }

          @media (min-width: 769px) {
             .post-modal-media img, 
             .post-modal-media video {
                height: auto !important;
                max-height: 85vh; 
             }
          }

          /* INPUT AREA */
          .comment-input-area {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 16px !important;
            border-top: 1px solid #334155; 
            background-color: #0f172a; 
          }

          .comment-input-area textarea {
            flex: 1;
            background: #1e293b; 
            border: 1px solid #334155;
            border-radius: 24px;
            padding: 10px 16px;
            resize: none;
            min-height: 44px;
            max-height: 100px;
            font-family: inherit;
            outline: none;
            font-size: 0.95rem;
            line-height: 1.4;
            color: #f8fafc;
          }
          
          .comment-input-area textarea::placeholder {
            color: #94a3b8;
          }

          .send-btn {
            background: #3b82f6 !important; 
            color: #ffffff !important; 
            font-weight: 600;
            border: none;
            border-radius: 8px; 
            padding: 8px 16px; 
            height: auto;
            cursor: pointer;
            transition: opacity 0.2s;
            font-size: 0.9rem;
            white-space: nowrap;
          }
          
          .send-btn:hover:not(:disabled) {
            background: #2563eb !important;
          }

          .send-btn:disabled {
            background: #475569 !important;
            color: #cbd5e1 !important;
            cursor: default;
          }

          /* MOBILE OVERRIDES */
          @media (max-width: 768px) {
            .post-modal-content {
              display: flex !important;
              flex-direction: column !important;
              overflow-y: auto !important;
              overflow-x: hidden !important;
              height: 100% !important;
              padding: 0 !important;
            }

            /* --- DYNAMIC HEIGHT CAROUSEL --- */
            /* Viewport height is controlled by JS state 'carouselHeight' */
            /* This is the key fix for the gap */
            .post-modal-carousel__viewport {
                width: 100% !important;
                min-height: 0 !important;
                overflow: hidden !important;
                transition: height 0.3s ease; /* Smooth transition */
            }

            .post-modal-carousel__container {
               display: flex !important; 
               flex-direction: row !important;
               /* Align start prevents stretching shorter slides */
               align-items: flex-start !important; 
               height: auto !important;
               width: 100% !important;
               margin-left: 0 !important;
            }

            .post-modal-carousel__slide {
               flex: 0 0 100% !important; 
               min-width: 100% !important;
               height: auto !important;
               display: block !important;
               padding: 0 !important;
            }
            
            /* Images have natural height, no gaps */
            .post-modal-media img, 
            .post-modal-media video {
               width: 100% !important;
               height: auto !important;
               max-height: none !important;
               object-fit: contain !important;
               display: block !important;
               margin: 0 !important;
               border: none !important;
            }

            .post-modal-comments {
              flex: 1 0 auto !important;
              overflow: visible !important;
              height: auto !important;
              padding: 0 15px 20px 15px; 
            }

            .comment-list, .post-likes-list {
              height: auto !important;
              max-height: none !important;
              overflow: visible !important;
            }

            .comment-input-area {
              position: sticky !important;
              bottom: 0;
              z-index: 50;
            }
          }
        `}</style>

        {/* --- MEDIA SECTION --- */}
        <div
          className={`post-modal-media${
            useCarousel ? " post-modal-media--carousel" : ""
          }`}>
          {slides.length > 0 ? (
            <div className="post-modal-carousel">
              {/* Dynamic Height applied to Viewport */}
              <div
                className="post-modal-carousel__viewport"
                ref={emblaRef}
                style={{ height: carouselHeight }}>
                <div className="post-modal-carousel__container">
                  {slides.map((item, index) => {
                    const key = item.src ?? `slide-${index}`;
                    return (
                      <div
                        className="post-modal-carousel__slide"
                        key={key}
                        style={{ position: "relative" }}>
                        {item.type === "video" ? (
                          <video
                            src={item.src}
                            controls
                            loop
                          />
                        ) : (
                          <img
                            src={item.src}
                            alt={post.content || TEXT_MEDIA_ALT}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">No media available</div>
          )}
        </div>

        {/* --- COMMENTS SECTION --- */}
        <div className="post-modal-comments">
          {post.content && (
            <div
              style={{
                border: "1px solid #334155",
                borderRadius: "14px",
                padding: "0.75rem",
                marginBottom: "1rem",
                backgroundColor: "rgba(255,255,255,0.03)",
                marginTop: "1rem",
              }}>
              <div
                style={{
                  fontWeight: 600,
                  marginBottom: "0.35rem",
                  color: "#fff",
                }}>
                {post.author.name}
              </div>
              <ExpandableText text={post.content} />
            </div>
          )}
          <div
            className="post-engagement"
            style={{ marginTop: "0.25rem", gap: "0.5rem" }}>
            <button
              type="button"
              className={post.liked ? "liked" : ""}
              onClick={() => onToggleLike?.(post.id)}>
              {likeToggleLabel}
            </button>
            <button
              type="button"
              onClick={setLikesMode}>
              {likeCountLabel}
            </button>
            <button
              type="button"
              onClick={setCommentsMode}>
              {commentCountLabel}
            </button>
          </div>
          {isLikesMode ? (
            <div className="post-likes-wrapper">
              <div
                className="post-likes-list"
                ref={likesScrollRef}
                onScroll={handleLikesScroll}>
                {likesContent}
                {likesLoading && (
                  <div
                    className="post-likes-loading"
                    aria-live="polite">
                    {TEXT_LIKES_LOADING}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="comment-list">
              {post.comments.length === 0 && (
                <div className="empty-state">{TEXT_NO_COMMENTS}</div>
              )}
              {post.comments.map((comment) => {
                const profilePath = buildProfilePath(comment.author);
                return (
                  <div
                    key={comment.id}
                    className="comment-item">
                    <img
                      src={comment.author.avatar}
                      alt={comment.author.name}
                      className="comment-item-avatar"
                    />
                    <div
                      className="comment-item-body"
                      style={{ flex: 1 }}>
                      <h6>
                        {profilePath ? (
                          <NavLink
                            to={profilePath}
                            style={{
                              color: "inherit",
                              textDecoration: "none",
                            }}>
                            {comment.author.name || TEXT_UNKNOWN_USER}
                          </NavLink>
                        ) : (
                          comment.author.name || TEXT_UNKNOWN_USER
                        )}
                      </h6>
                      <ExpandableText
                        text={comment.text}
                        maxLines={3}
                      />
                      <div className="comment-item-meta">
                        <span>{formatTimeAgoBangla(comment.createdAt)}</span>
                        {canDeleteComment?.(comment) && (
                          <button
                            type="button"
                            className="comment-delete-btn"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              onDeleteComment?.(post.id, comment.id);
                            }}
                            aria-label={TEXT_DELETE_COMMENT_ARIA}>
                            <DeleteOutlineIcon width={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* --- INPUT AREA --- */}
        <div className="comment-input-area">
          <textarea
            ref={textareaRef}
            name="comment"
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            placeholder={TEXT_COMMENT_PLACEHOLDER}
            rows={1}
          />
          <button
            type="button"
            className="send-btn"
            onClick={handleSubmitComment}
            disabled={!commentText.trim()}
            aria-label="Send Comment">
            {TEXT_SUBMIT_BTN_LABEL}
          </button>
        </div>
      </div>
    </Modal>
  );
}

PostModal.propTypes = {
  open: PropTypes.bool,
  post: PropTypes.any,
  mode: PropTypes.oneOf(["comments", "likes"]),
  onClose: PropTypes.func,
  onToggleLike: PropTypes.func,
  onAddComment: PropTypes.func,
  onDeleteComment: PropTypes.func,
  canDeleteComment: PropTypes.func,
  initialSlideIndex: PropTypes.number,
};
