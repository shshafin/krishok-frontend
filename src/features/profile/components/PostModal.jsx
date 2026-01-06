import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { NavLink } from "react-router-dom";
import { format } from "timeago.js";

import DeleteOutlineIcon from "@/assets/IconComponents/DeleteOutlineIcon";
import { LiquedLoader } from "@/components/loaders";
import Modal from "./Modal";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { useVideoVisibility, useModalVideoController } from "@/hooks/useVideoVisibility";
import ExpandableText from "@/components/ui/ExpandableText";

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
  "\u098F\u0996\u09BE\u09A8\u09C7 \u09AE\u09A8\u09CD\u09A4\u09AC\u09CD\u09AF \u09B2\u09BF\u0996\u09C1\u09A8...";
const TEXT_SUBMIT_COMMENT =
  "\u09AE\u09A8\u09CD\u09A4\u09AC\u09CD\u09AF \u0995\u09B0\u09C1\u09A8";
const TEXT_DELETE_COMMENT_ARIA =
  "\u09AE\u09A8\u09CD\u09A4\u09AC\u09CD\u09AF \u09AE\u09C1\u099B\u09C1\u09A8";
const TEXT_LIKES_LOADING =
  "\u09B2\u09BE\u0987\u0995 \u09A4\u09A5\u09CD\u09AF \u09B2\u09CB\u09A1 \u09B9\u099A\u09CD\u099B\u09C7...";
const TEXT_UNKNOWN_USER =
  "\u0985\u099C\u09BE\u09A8\u09BE \u09AC\u09CD\u09AF\u09AC\u09B9\u09BE\u09B0\u0995\u09BE\u09B0\u09C0";
const TEXT_MEDIA_ALT =
  "\u09AA\u09CB\u09B8\u09CD\u099F\u09C7\u09B0 \u099B\u09AC\u09BF";
const CLOSE_SYMBOL = "\u00D7";

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
  const slug = trimmed.toLowerCase().replace(/\s+/g, "-");
  return `/user/${encodeURIComponent(slug)}`;
};

export default function PostModal({
  open,
  post,
  mode,
  startIndex,
  onClose,
  onToggleLike,
  onAddComment,
  onDeleteComment,
  canDeleteComment,
}) {
  const [commentText, setCommentText] = useState("");
  const [visibleLikes, setVisibleLikes] = useState([]);
  const [likesCursor, setLikesCursor] = useState(0);
  const [likesLoading, setLikesLoading] = useState(false);
  const [activeMode, setActiveMode] = useState(mode ?? "comments");
  const [carouselHeight, setCarouselHeight] = useState(null);

  // Notify global controller about modal state
  useModalVideoController(open);

  // Video visibility hook for viewport-based play/pause with modal priority
  const videoRef = useVideoVisibility({ threshold: 0.5, priority: 'modal' });

  const likesScrollRef = useRef(null);
  const likesThrottleRef = useRef(false);
  const likesTimerRef = useRef(null);
  const autoplayPlugin = useMemo(
    () =>
      Autoplay({
        delay: 4000,
        playOnInit: true,
        stopOnInteraction: false,
        stopOnMouseEnter: true,
      }),
    []
  );

  const likedUsers = useMemo(
    () => (Array.isArray(post?.likedUsers) ? post.likedUsers : []),
    [post]
  );
  const isLikesMode = activeMode === "likes";

  const media = post?.media ?? null;
  const galleryImages = useMemo(() => {
    if (!post) {
      return [];
    }
    const rawGallery = Array.isArray(post.mediaGallery)
      ? post.mediaGallery.filter(
        (item) => item && item.type === "image" && item.src
      )
      : [];
    if (rawGallery.length > 0) {
      return rawGallery;
    }
    if (media?.type === "image" && media?.src) {
      return [{ type: "image", src: media.src }];
    }
    return [];
  }, [post, media]);
  const useCarousel = galleryImages.length > 1;
  const hasGallery = galleryImages.length > 0;
  const hasVideo = media?.type === "video" && media?.src;

  const slideImgRefs = useRef([]);

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      align: "start",
      loop: useCarousel,
    },
    useCarousel ? [autoplayPlugin] : []
  );

  const syncCarouselHeight = useCallback(() => {
    if (!useCarousel) return;
    if (!emblaApi) return;

    const selectedIndex = emblaApi.selectedScrollSnap();
    const imgEl = slideImgRefs.current?.[selectedIndex] ?? null;
    if (!imgEl) return;

    const rect = imgEl.getBoundingClientRect();
    if (!rect?.height) return;

    setCarouselHeight((prev) => {
      const next = Math.round(rect.height);
      return prev === next ? prev : next;
    });
  }, [useCarousel, emblaApi]);

  useEffect(() => {
    if (!open) return;
    if (!useCarousel) return;
    if (!emblaApi) return;

    const total = galleryImages.length;
    if (!total) return;

    const rawIndex = Number.isFinite(startIndex) ? startIndex : 0;
    const clampedIndex = Math.max(0, Math.min(rawIndex, total - 1));
    emblaApi.scrollTo(clampedIndex, true);
    requestAnimationFrame(() => {
      syncCarouselHeight();
    });
  }, [open, useCarousel, emblaApi, startIndex, galleryImages.length]);

  useEffect(() => {
    if (!open) return;
    if (!useCarousel) return;
    if (!emblaApi) return;

    syncCarouselHeight();

    emblaApi.on("select", syncCarouselHeight);
    emblaApi.on("reInit", syncCarouselHeight);

    const handleResize = () => syncCarouselHeight();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      emblaApi.off("select", syncCarouselHeight);
      emblaApi.off("reInit", syncCarouselHeight);
    };
  }, [open, useCarousel, emblaApi, syncCarouselHeight]);

  useEffect(() => {
    if (!open) return;
    setActiveMode(mode ?? "comments");
  }, [mode, open]);

  useEffect(() => {
    if (open && activeMode !== "likes") {
      setCommentText("");
    }
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

  useEffect(
    () => () => {
      if (likesTimerRef.current) {
        clearTimeout(likesTimerRef.current);
        likesTimerRef.current = null;
      }
      likesThrottleRef.current = false;
    },
    []
  );

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
      if (!target) return;

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
  }, [commentText, onAddComment, post]);

  const likesContent = useMemo(() => {
    if (!post) {
      return [];
    }

    if (visibleLikes.length === 0 && !likesLoading) {
      return <div className="empty-state">{TEXT_NO_LIKES}</div>;
    }

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

  if (!post) {
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
  }

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
            {format(post.createdAt)}
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
        <div
          className={`post-modal-media${useCarousel ? " post-modal-media--carousel" : ""
            }`}>
          {hasVideo ? (
            <video
              ref={videoRef}
              src={media.src}
              controls
              loop
            />
          ) : hasGallery ? (
            useCarousel ? (
              <div className="post-modal-carousel">
                <div
                  className="post-modal-carousel__viewport"
                  ref={emblaRef}
                  style={
                    carouselHeight
                      ? { height: `${carouselHeight}px`, transition: "height 180ms ease" }
                      : undefined
                  }>
                  <div className="post-modal-carousel__container">
                    {galleryImages.map((item, index) => {
                      const key = item.src ?? `slide-${index}`;
                      return (
                        <div
                          className="post-modal-carousel__slide"
                          key={key}>
                          <img
                            src={item.src}
                            alt={post.content || TEXT_MEDIA_ALT}
                            ref={(node) => {
                              slideImgRefs.current[index] = node;
                            }}
                            onLoad={() => {
                              if (!emblaApi) return;
                              if (emblaApi.selectedScrollSnap() === index) {
                                syncCarouselHeight();
                              }
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <img
                src={galleryImages[0]?.src}
                alt={post.content || TEXT_MEDIA_ALT}
              />
            )
          ) : null}
        </div>

        <section>
          <div className="post-modal-comments">
            {post.content && (
              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "14px",
                  padding: "0.75rem",
                }}>
                <div style={{ fontWeight: 600, marginBottom: "0.35rem" }}>
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
              <>
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
                                style={{ color: "inherit", textDecoration: "none" }}
                              >
                                {comment.author.name || TEXT_UNKNOWN_USER}
                              </NavLink>
                            ) : (
                              comment.author.name || TEXT_UNKNOWN_USER
                            )}
                          </h6>
                          <ExpandableText text={comment.text} maxLines={3} />
                          <div className="comment-item-meta">
                            <span>{format(comment.createdAt)}</span>
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
              </>
            )}
          </div>

          <div className="comment-input-area">
            <textarea
              name="comment"
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              placeholder={TEXT_COMMENT_PLACEHOLDER}
            />
            <button
              type="button"
              onClick={handleSubmitComment}
              disabled={!commentText.trim()}>
              {TEXT_SUBMIT_COMMENT}
            </button>
          </div>
        </section>
      </div>
    </Modal>
  );
}

PostModal.propTypes = {
  open: PropTypes.bool,
  post: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    content: PropTypes.string,
    createdAt: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.instanceOf(Date),
    ]).isRequired,
    media: PropTypes.shape({
      type: PropTypes.oneOf(["image", "video"]),
      src: PropTypes.string,
    }),
    likes: PropTypes.number,
    liked: PropTypes.bool,
    likedUsers: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        name: PropTypes.string,
        username: PropTypes.string,
        avatar: PropTypes.string,
      })
    ),
    mediaGallery: PropTypes.arrayOf(
      PropTypes.shape({
        type: PropTypes.oneOf(["image"]),
        src: PropTypes.string,
      })
    ),
    comments: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
          .isRequired,
        text: PropTypes.string.isRequired,
        createdAt: PropTypes.oneOfType([
          PropTypes.string,
          PropTypes.instanceOf(Date),
        ]).isRequired,
        author: PropTypes.shape({
          id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
          name: PropTypes.string.isRequired,
          avatar: PropTypes.string.isRequired,
          username: PropTypes.string,
        }).isRequired,
      })
    ),
    author: PropTypes.shape({
      name: PropTypes.string.isRequired,
      avatar: PropTypes.string.isRequired,
    }).isRequired,
  }),
  mode: PropTypes.oneOf(["comments", "likes"]),
  startIndex: PropTypes.number,
  onClose: PropTypes.func,
  onToggleLike: PropTypes.func,
  onAddComment: PropTypes.func,
  onDeleteComment: PropTypes.func,
  canDeleteComment: PropTypes.func,
};

PostModal.defaultProps = {
  open: false,
  post: null,
  mode: "comments",
  startIndex: 0,
  onClose: undefined,
  onToggleLike: undefined,
  onAddComment: undefined,
  onDeleteComment: undefined,
  canDeleteComment: undefined,
};
