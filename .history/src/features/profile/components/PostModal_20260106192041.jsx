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
const TEXT_LIKE_TOGGLE_ACTIVE = "লাইক করা হয়েছে";
const TEXT_LIKE_TOGGLE_INACTIVE = "লাইক";
const TEXT_LIKES_LABEL = "লাইক";
const TEXT_COMMENTS_LABEL = "মন্তব্য";
const TEXT_NO_LIKES = "এখনও কোনো লাইক নেই";
const TEXT_NO_COMMENTS = "এখনও কোনো মন্তব্য নেই";
const TEXT_COMMENT_PLACEHOLDER = "মন্তব্য লিখুন...";
const TEXT_SUBMIT_BTN_LABEL = "পোস্ট";
const TEXT_DELETE_COMMENT_ARIA = "মন্তব্য মুছুন";
const TEXT_LIKES_LOADING = "লাইক তথ্য লোড হচ্ছে...";
const TEXT_UNKNOWN_USER = "অজানা ব্যবহারকারী";
const TEXT_MEDIA_ALT = "পোস্টের ছবি";
const CLOSE_SYMBOL = "×";

// --- HELPERS ---
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
  if (!user) return null;
  const id = user.id || user._id;
  return id ? `/user/${id}` : null;
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
  const [carouselHeight, setCarouselHeight] = useState("auto");

  useModalVideoController(open);
  const videoRef = useVideoVisibility({ threshold: 0.5, priority: "modal" });
  const likesScrollRef = useRef(null);
  const textareaRef = useRef(null);

  const autoplayPlugin = useMemo(
    () => Autoplay({ delay: 4000, playOnInit: false, stopOnInteraction: true }),
    []
  );

  const slides = useMemo(() => {
    if (!post) return [];
    let gallery = [];
    if (Array.isArray(post.mediaGallery) && post.mediaGallery.length > 0) {
      gallery = post.mediaGallery.filter((item) => item && item.src);
    } else if (post.media && post.media.src) {
      gallery = [post.media];
    }
    return gallery;
  }, [post]);

  const useCarousel = slides.length > 1;
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      align: "center",
      loop: useCarousel,
      startIndex: initialSlideIndex,
    },
    useCarousel ? [autoplayPlugin] : []
  );

  // --- DYNAMIC HEIGHT LOGIC (Your Logic + Or's Smoothness) ---
  const updateHeight = useCallback(() => {
    if (!emblaApi) return;
    const slidesNodes = emblaApi.slideNodes();
    const index = emblaApi.selectedScrollSnap();
    const currentSlide = slidesNodes[index];
    if (currentSlide) {
      const img = currentSlide.querySelector("img, video");
      if (img) {
        const height = img.getBoundingClientRect().height;
        if (height > 0) setCarouselHeight(`${height}px`);
      }
    }
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi || !open) return;
    emblaApi.on("select", updateHeight);
    emblaApi.on("reInit", updateHeight);
    window.addEventListener("resize", updateHeight);

    // Initial sync
    setTimeout(updateHeight, 150);

    return () => {
      emblaApi.off("select", updateHeight);
      emblaApi.off("reInit", updateHeight);
      window.removeEventListener("resize", updateHeight);
    };
  }, [emblaApi, open, updateHeight]);

  // Handle re-init when modal opens
  useEffect(() => {
    if (open && emblaApi) {
      emblaApi.reInit();
      emblaApi.scrollTo(initialSlideIndex, true);
    }
  }, [open, emblaApi, initialSlideIndex, slides]);

  // Handle comment height auto-resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        100
      )}px`;
    }
  }, [commentText]);

  const handleSubmitComment = () => {
    const value = commentText.trim();
    if (!value || !post) return;
    onAddComment?.(post.id, value);
    setCommentText("");
  };

  if (!post) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
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
                width: 44,
                height: 44,
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
            <div>
              <div style={{ fontWeight: 600, color: "#fff" }}>
                {post.author.name}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                {formatTimeAgoBangla(post.createdAt)}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ka-modal-close">
            {CLOSE_SYMBOL}
          </button>
        </div>
      }
      size="xl"
      className="post-modal post-modal--top"
      backdropZIndex={2000}>
      <div className="post-modal-content">
        <style>{`
          .post-modal-content { display: flex; flex-direction: column; background: #0f172a; }
          .post-modal-media { background: #000; width: 100%; display: flex; align-items: center; justify-content: center; overflow: hidden; }
          .post-modal-carousel__viewport { width: 100%; transition: height 0.2s ease; overflow: hidden; }
          .post-modal-carousel__container { display: flex; align-items: flex-start; }
          .post-modal-carousel__slide { flex: 0 0 100%; min-width: 0; }
          .post-modal-media img, .post-modal-media video { width: 100%; height: auto; display: block; object-fit: contain; }
          
          .post-modal-comments { padding: 16px; color: #fff; flex: 1; }
          .comment-input-area { position: sticky; bottom: 0; padding: 12px; background: #0f172a; border-top: 1px solid #334155; display: flex; gap: 10px; align-items: center; }
          .comment-input-area textarea { flex: 1; background: #1e293b; border: 1px solid #334155; border-radius: 20px; padding: 8px 15px; color: #fff; resize: none; outline: none; }
          .send-btn { background: #3b82f6; color: #fff; padding: 6px 15px; border-radius: 15px; font-weight: 600; border: none; }
          
          @media (max-width: 768px) {
            .post-modal-media img, .post-modal-media video { max-height: 70vh; }
            .post-modal-content { height: 100%; overflow-y: auto; }
          }
        `}</style>

        {/* MEDIA */}
        <div className="post-modal-media">
          <div
            className="post-modal-carousel__viewport"
            ref={emblaRef}
            style={{ height: carouselHeight }}>
            <div className="post-modal-carousel__container">
              {slides.map((item, idx) => (
                <div
                  className="post-modal-carousel__slide"
                  key={idx}>
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
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* BODY */}
        <div className="post-modal-comments">
          {post.content && (
            <div
              style={{
                background: "rgba(255,255,255,0.05)",
                padding: "12px",
                borderRadius: "12px",
                marginBottom: "15px",
              }}>
              <div style={{ fontWeight: 600, marginBottom: "4px" }}>
                {post.author.name}
              </div>
              <ExpandableText text={post.content} />
            </div>
          )}

          <div
            className="post-engagement"
            style={{ display: "flex", gap: "15px", marginBottom: "15px" }}>
            <button
              onClick={() => onToggleLike?.(post.id)}
              className={post.liked ? "liked" : ""}>
              {post.liked ? TEXT_LIKE_TOGGLE_ACTIVE : TEXT_LIKE_TOGGLE_INACTIVE}{" "}
              ({post.likes})
            </button>
            <span>
              {post.comments.length} {TEXT_COMMENTS_LABEL}
            </span>
          </div>

          <div className="comment-list">
            {post.comments.map((comment) => (
              <div
                key={comment.id}
                className="comment-item"
                style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
                <img
                  src={comment.author.avatar}
                  style={{ width: 32, height: 32, borderRadius: "50%" }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                    {comment.author.name}
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "#cbd5e1" }}>
                    {comment.text}
                  </div>
                </div>
                {canDeleteComment?.(comment) && (
                  <button
                    onClick={() => onDeleteComment?.(post.id, comment.id)}>
                    <DeleteOutlineIcon width={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* FOOTER INPUT */}
        <div className="comment-input-area">
          <textarea
            ref={textareaRef}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={TEXT_COMMENT_PLACEHOLDER}
            rows={1}
          />
          <button
            className="send-btn"
            onClick={handleSubmitComment}
            disabled={!commentText.trim()}>
            {TEXT_SUBMIT_BTN_LABEL}
          </button>
        </div>
      </div>
    </Modal>
  );
}
