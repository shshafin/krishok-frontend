/* eslint-disable no-unused-vars */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { NavLink } from "react-router-dom";
import { format } from "timeago.js";
import DeleteOutlineIcon from "@/assets/IconComponents/DeleteOutlineIcon";
import { LiquedLoader } from "@/components/loaders";
import Modal from "./Modal";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import {
  useVideoVisibility,
  useModalVideoController,
} from "@/hooks/useVideoVisibility";
import ExpandableText from "@/components/ui/ExpandableText";

// --- CONSTANTS ---
const LIKES_CHUNK = 12;
const TEXT_LOADING = "লোড হচ্ছে...";
const TEXT_LIKE_TOGGLE_ACTIVE = "লাইক করা হয়েছে";
const TEXT_LIKE_TOGGLE_INACTIVE = "লাইক";
const TEXT_LIKES_LABEL = "লাইক";
const TEXT_COMMENTS_LABEL = "মন্তব্য";
const TEXT_COMMENT_PLACEHOLDER = "এখানে মন্তব্য লিখুন...";
const TEXT_SUBMIT_COMMENT = "মন্তব্য করুন";
const TEXT_DELETE_COMMENT_ARIA = "মন্তব্য মুছুন";
const CLOSE_SYMBOL = "×";

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
  const [activeMode, setActiveMode] = useState(mode ?? "comments");
  const [carouselHeight, setCarouselHeight] = useState(null);

  useModalVideoController(open);
  const videoRef = useVideoVisibility({ threshold: 0.5, priority: "modal" });
  const textareaRef = useRef(null);
  const slideImgRefs = useRef([]);

  const autoplayPlugin = useMemo(
    () => Autoplay({ delay: 4000, stopOnInteraction: true }),
    []
  );

  const slides = useMemo(() => {
    if (!post) return [];
    const gallery = Array.isArray(post.mediaGallery)
      ? post.mediaGallery.filter((i) => i && i.src)
      : [];
    if (gallery.length > 0) return gallery;
    return post.media?.src ? [post.media] : [];
  }, [post]);

  const useCarousel = slides.length > 1;
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      align: "start",
      loop: useCarousel,
      startIndex: initialSlideIndex,
    },
    useCarousel ? [autoplayPlugin] : []
  );

  // --- DESIGN FIX: OR CODE ER HEIGHT SYNC ---
  const syncCarouselHeight = useCallback(() => {
    if (!emblaApi) return;
    const selectedIndex = emblaApi.selectedScrollSnap();
    const imgEl = slideImgRefs.current?.[selectedIndex];
    if (imgEl) {
      const rect = imgEl.getBoundingClientRect();
      if (rect?.height) setCarouselHeight(Math.round(rect.height));
    }
  }, [emblaApi]);

  useEffect(() => {
    if (open && emblaApi) {
      emblaApi.reInit();
      emblaApi.scrollTo(initialSlideIndex, true);
      setTimeout(syncCarouselHeight, 150);
      emblaApi.on("select", syncCarouselHeight);
      emblaApi.on("reInit", syncCarouselHeight);
      window.addEventListener("resize", syncCarouselHeight);
      return () => {
        window.removeEventListener("resize", syncCarouselHeight);
        emblaApi.off("select", syncCarouselHeight);
        emblaApi.off("reInit", syncCarouselHeight);
      };
    }
  }, [open, emblaApi, initialSlideIndex, syncCarouselHeight]);

  const handleSubmitComment = () => {
    if (!commentText.trim()) return;
    onAddComment?.(post.id, commentText.trim());
    setCommentText("");
  };

  if (!post) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      className="post-modal post-modal--top"
      backdropZIndex={2000}
      header={
        <div
          className="ka-modal-header"
          style={{ gap: "0.75rem" }}>
          <div
            style={{ display: "flex", gap: "0.65rem", alignItems: "center" }}>
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
              <div style={{ fontWeight: 600, color: "#fff" }}>
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
            onClick={onClose}>
            {CLOSE_SYMBOL}
          </button>
        </div>
      }>
      <div className="post-modal-content">
        {/* MEDIA SECTION - Design from Fix Branch */}
        <div
          className={`post-modal-media ${
            useCarousel ? "post-modal-media--carousel" : ""
          }`}>
          <div className="post-modal-carousel">
            <div
              className="post-modal-carousel__viewport"
              ref={emblaRef}
              style={
                carouselHeight
                  ? {
                      height: `${carouselHeight}px`,
                      transition: "height 180ms ease",
                    }
                  : undefined
              }>
              <div className="post-modal-carousel__container">
                {slides.map((item, index) => (
                  <div
                    className="post-modal-carousel__slide"
                    key={index}>
                    {item.type === "video" ? (
                      <video
                        src={item.src}
                        ref={videoRef}
                        controls
                        loop
                        playsInline
                      />
                    ) : (
                      <img
                        src={item.src}
                        alt={TEXT_MEDIA_ALT}
                        ref={(node) => {
                          slideImgRefs.current[index] = node;
                        }}
                        onLoad={syncCarouselHeight}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* INFO SECTION - Fixed Design Structure */}
        <section>
          <div className="post-modal-comments">
            {post.content && (
              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "14px",
                  padding: "0.75rem",
                  marginBottom: "1rem",
                }}>
                <div style={{ fontWeight: 600, marginBottom: "0.35rem" }}>
                  {post.author.name}
                </div>
                <ExpandableText text={post.content} />
              </div>
            )}

            <div
              className="post-engagement"
              style={{ marginTop: "0.25rem", gap: "0.5rem", display: "flex" }}>
              <button
                type="button"
                className={post.liked ? "liked" : ""}
                onClick={() => onToggleLike?.(post.id)}>
                {post.liked
                  ? "❤️ " + TEXT_LIKE_TOGGLE_ACTIVE
                  : "🤍 " + TEXT_LIKE_TOGGLE_INACTIVE}
              </button>
              <button
                type="button"
                onClick={() => setActiveMode("likes")}>
                {post.likes} {TEXT_LIKES_LABEL}
              </button>
              <button
                type="button"
                onClick={() => setActiveMode("comments")}>
                {post.comments.length} {TEXT_COMMENTS_LABEL}
              </button>
            </div>

            <div
              className="comment-list"
              style={{ marginTop: "1rem" }}>
              {post.comments.map((comment) => (
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
                    <h6 style={{ margin: 0 }}>{comment.author.name}</h6>
                    <p
                      style={{
                        margin: "4px 0",
                        fontSize: "0.9rem",
                        color: "#cbd5e1",
                      }}>
                      {comment.text}
                    </p>
                    <div
                      className="comment-item-meta"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}>
                      <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                        {format(comment.createdAt)}
                      </span>
                      {canDeleteComment?.(comment) && (
                        <button
                          type="button"
                          className="comment-delete-btn"
                          onClick={() =>
                            onDeleteComment?.(post.id, comment.id)
                          }>
                          <DeleteOutlineIcon width={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* COMMENT INPUT - Or's Style */}
          <div className="comment-input-area">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={TEXT_COMMENT_PLACEHOLDER}
              style={{ width: "100%", minHeight: "44px" }}
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
