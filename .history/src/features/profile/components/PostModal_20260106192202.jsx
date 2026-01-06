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

const LIKES_CHUNK = 12;
const TEXT_SUBMIT_BTN_LABEL = "পোস্ট";
const CLOSE_SYMBOL = "×";

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
      .replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[d]);
  } catch (e) {
    return "";
  }
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
  const [activeMode, setActiveMode] = useState(mode ?? "comments");
  const [carouselHeight, setCarouselHeight] = useState("auto");

  useModalVideoController(open);
  const videoRef = useVideoVisibility({ threshold: 0.5, priority: "modal" });
  const textareaRef = useRef(null);

  const slides = useMemo(() => {
    if (!post) return [];
    return post.mediaGallery?.length > 0
      ? post.mediaGallery
      : post.media
      ? [post.media]
      : [];
  }, [post]);

  const useCarousel = slides.length > 1;
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      align: "center",
      loop: useCarousel,
      startIndex: initialSlideIndex,
    },
    useCarousel ? [Autoplay({ delay: 4000, stopOnInteraction: true })] : []
  );

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
    if (emblaApi && open) {
      emblaApi.on("select", updateHeight);
      emblaApi.on("reInit", updateHeight);
      setTimeout(updateHeight, 200);
      return () => {
        emblaApi.off("select", updateHeight);
        emblaApi.off("reInit", updateHeight);
      };
    }
  }, [emblaApi, open, updateHeight]);

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
      backdropZIndex={2000}
      header={
        <div
          className="ka-modal-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            padding: "10px 15px",
          }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <img
              src={post.author.avatar}
              style={{ width: 40, height: 40, borderRadius: "50%" }}
            />
            <div>
              <div
                style={{ fontWeight: 600, color: "#fff", fontSize: "0.9rem" }}>
                {post.author.name}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                {formatTimeAgoBangla(post.createdAt)}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ color: "#fff", fontSize: "24px" }}>
            {CLOSE_SYMBOL}
          </button>
        </div>
      }>
      <div className="post-modal-wrapper">
        <style>{`
          /* DESKTOP LAYOUT (Side by Side) */
          .post-modal-wrapper {
            display: grid;
            grid-template-columns: 1.2fr 0.8fr; /* Media Left, Info Right */
            background: #0f172a;
            height: 80vh;
            max-height: 800px;
            overflow: hidden;
          }

          .post-modal-media-section {
            background: #000;
            display: flex;
            align-items: center;
            justify-content: center;
            border-right: 1px solid #334155;
            position: relative;
          }

          .post-modal-info-section {
            display: flex;
            flex-direction: column;
            height: 100%;
            background: #0f172a;
          }

          .post-modal-scroll-area {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
          }

          /* CAROUSEL FIXED */
          .embla__viewport { width: 100%; height: 100%; }
          .embla__container { display: flex; height: 100%; }
          .embla__slide { flex: 0 0 100%; min-width: 0; display: flex; align-items: center; justify-content: center; }
          .embla__slide img, .embla__slide video { max-width: 100%; max-height: 100%; object-fit: contain; }

          /* MOBILE OVERRIDES */
          @media (max-width: 768px) {
            .post-modal-wrapper {
              display: block; /* Stack vertically on mobile */
              height: 100vh;
              overflow-y: auto;
            }
            .post-modal-media-section {
               border-right: none;
               min-height: 300px;
            }
            .post-modal-info-section {
              height: auto;
            }
            .post-modal-scroll-area {
              overflow-y: visible;
            }
          }
        `}</style>

        {/* LEFT: MEDIA SECTION */}
        <div className="post-modal-media-section">
          <div
            className="embla__viewport"
            ref={emblaRef}>
            <div className="embla__container">
              {slides.map((item, idx) => (
                <div
                  className="embla__slide"
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
                      alt="media"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: INFO/COMMENTS SECTION */}
        <div className="post-modal-info-section">
          <div className="post-modal-scroll-area">
            {/* Post Content */}
            <div
              style={{
                marginBottom: "20px",
                paddingBottom: "15px",
                borderBottom: "1px solid #334155",
              }}>
              <div
                style={{ fontWeight: 600, color: "#fff", marginBottom: "8px" }}>
                {post.author.name}
              </div>
              <ExpandableText text={post.content} />
            </div>

            {/* Engagement Stats */}
            <div
              style={{
                display: "flex",
                gap: "15px",
                marginBottom: "15px",
                color: "#94a3b8",
                fontSize: "0.9rem",
              }}>
              <button
                onClick={() => onToggleLike?.(post.id)}
                className={post.liked ? "liked" : ""}>
                {post.liked ? "❤️" : "🤍"} {post.likes} লাইক
              </button>
              <span>💬 {post.comments.length} মন্তব্য</span>
            </div>

            {/* Comments List */}
            <div className="comment-list">
              {post.comments.map((comment) => (
                <div
                  key={comment.id}
                  style={{
                    display: "flex",
                    gap: "10px",
                    marginBottom: "15px",
                  }}>
                  <img
                    src={comment.author.avatar}
                    style={{ width: 32, height: 32, borderRadius: "50%" }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        color: "#fff",
                        fontSize: "0.85rem",
                      }}>
                      {comment.author.name}
                    </div>
                    <div style={{ color: "#cbd5e1", fontSize: "0.85rem" }}>
                      {comment.text}
                    </div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "#64748b",
                        marginTop: "4px",
                      }}>
                      {formatTimeAgoBangla(comment.createdAt)}
                    </div>
                  </div>
                  {canDeleteComment?.(comment) && (
                    <button
                      onClick={() => onDeleteComment?.(post.id, comment.id)}
                      style={{ color: "#ef4444" }}>
                      <DeleteOutlineIcon width={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Comment Input Footer */}
          <div
            style={{
              padding: "12px",
              borderTop: "1px solid #334155",
              display: "flex",
              gap: "10px",
              alignItems: "center",
            }}>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="মন্তব্য লিখুন..."
              style={{
                flex: 1,
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "20px",
                padding: "8px 15px",
                color: "#fff",
                resize: "none",
                height: "40px",
              }}
            />
            <button
              onClick={handleSubmitComment}
              disabled={!commentText.trim()}
              style={{
                background: "#3b82f6",
                color: "#fff",
                padding: "6px 15px",
                borderRadius: "20px",
                fontWeight: "bold",
              }}>
              {TEXT_SUBMIT_BTN_LABEL}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
