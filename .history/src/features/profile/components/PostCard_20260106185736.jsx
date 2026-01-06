import { useMemo } from "react"; // Removed useState as comment box is hidden
import ExpandableText from "@/components/ui/ExpandableText";
import { useLocation, NavLink } from "react-router-dom";
import PropTypes from "prop-types";
import { format } from "timeago.js";
import DeleteOutlineIcon from "@/assets/IconComponents/DeleteOutlineIcon";
import { useVideoVisibility } from "@/hooks/useVideoVisibility";
import { baseApi } from "../../../api";

// --- CONFIG ---
const API_URL = baseApi || "http://localhost:5001";

const TEXT_LIKED = "লাইক করা হয়েছে";
const TEXT_LIKE = "লাইক";
const TEXT_COMMENTS = "মন্তব্য";
// const TEXT_COMMENT = "মন্তব্য"; // Hiding Comment Text
// const TEXT_COMMENT_PLACEHOLDER = "মন্তব্য করুন..."; // Hiding Placeholder
const TEXT_DELETE_POST_ARIA = "পোস্ট মুছে ফেলুন";
const TEXT_MEDIA_ALT = "পোস্টের ছবি";
const TEXT_LIKE_COUNT_SUFFIX = "লাইক";
const TEXT_COMMENT_COUNT_SUFFIX = "মন্তব্য";

const ensureAbsoluteUrl = (url) => {
  if (!url) return null;
  if (url.startsWith("http") || url.startsWith("blob:")) return url;
  const cleanPath = url.startsWith("/") ? url.slice(1) : url;
  return `${API_URL}/${cleanPath}`;
};

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
    console.log(e);
    return "Time error";
  }
};

const mediaContainerStyles = {
  width: "100%",
  height: "350px",
  display: "grid",
  gap: "2px",
  marginTop: "12px",
  position: "relative",
  overflow: "hidden",
  borderRadius: "0",
  margin: "12px 0 0 0",
};

export default function PostCard({
  post,
  isOwner,
  onLike,
  onOpenLikes,
  onOpenComments,
  onDelete,
  // onAddComment, // Not needed if input is hidden
  onOpenPost,
}) {
  // const [commentText, setCommentText] = useState(""); // Hidden
  const location = useLocation();
  const videoRef = useVideoVisibility({ threshold: 0.3, priority: "normal" });

  const { normalizedGallery, displayAuthor } = useMemo(() => {
    // 1. Gallery Logic
    let gallery = post.mediaGallery || [];
    if (!Array.isArray(gallery) || gallery.length === 0) {
      gallery = [];
      const rawVideos = Array.isArray(post.videos)
        ? post.videos
        : post.video
        ? [post.video]
        : [];
      const rawImages = Array.isArray(post.images)
        ? post.images
        : post.image
        ? [post.image]
        : [];

      rawVideos.forEach((v) => {
        const src = typeof v === "object" ? v.src || v.url : v;
        if (src) gallery.push({ type: "video", src: ensureAbsoluteUrl(src) });
      });

      rawImages.forEach((i) => {
        const src = typeof i === "object" ? i.src || i.url : i;
        if (src) gallery.push({ type: "image", src: ensureAbsoluteUrl(src) });
      });
    }

    // 2. Author Logic
    const userObj = post.user || {};
    const authObj = post.author || {};

    // Priority: Author Object (from Parent) > User Object (Raw) > Username
    const realName =
      authObj.name ||
      userObj.name ||
      authObj.username ||
      userObj.username ||
      "Unknown";
    const userId = authObj.id || authObj._id || userObj._id || userObj.id;
    const avatarRaw =
      authObj.avatar ||
      authObj.profileImage ||
      userObj.profileImage ||
      userObj.avatar;
    const avatar = avatarRaw
      ? ensureAbsoluteUrl(avatarRaw)
      : `https://i.pravatar.cc/120?u=${userId}`;

    return {
      normalizedGallery: gallery,
      displayAuthor: { id: userId, name: realName, avatar },
    };
  }, [post]);

  const showDeleteButton = Boolean(
    isOwner && location?.pathname?.startsWith("/me")
  );

  /* // --- COMMENT SUBMIT LOGIC HIDDEN ---
  const submitComment = () => {
    const value = commentText.trim();
    if (!value) return;
    if (post.id) {
      onAddComment?.(post.id, value);
      setCommentText("");
    }
  };
  */

  // --- GRID CONFIG ---
  const displayItems = normalizedGallery.slice(0, 4);
  const extraImageCount =
    normalizedGallery.length > 4 ? normalizedGallery.length - 4 : 0;

  const getGridConfig = (count) => {
    if (count === 1)
      return {
        gridTemplateColumns: "1fr",
        height: "auto",
        maxHeight: "500px",
        aspectRatio: "auto",
      };
    if (count === 2) return { gridTemplateColumns: "1fr 1fr" };
    if (count === 3)
      return { gridTemplateColumns: "2fr 1fr", gridTemplateRows: "1fr 1fr" };
    if (count >= 4)
      return {
        gridTemplateColumns: "2fr 1fr",
        gridTemplateRows: "1fr 1fr 1fr",
      };
    return {};
  };

  const getItemStyle = (index, count) => {
    const baseStyle = {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      display: "block",
    };
    if (count === 3 && index === 0) return { ...baseStyle, gridRow: "span 2" };
    if (count >= 4 && index === 0) return { ...baseStyle, gridRow: "span 3" };
    return baseStyle;
  };

  return (
    <article
      className="post-card"
      style={{
        position: "relative",
        // Forced interaction to solve "frozen" state
        pointerEvents: "auto",
        zIndex: 1,
      }}>
      {/* HEADER */}
      <header className="post-card-header">
        <NavLink
          to={`/user/${displayAuthor.id}`}
          className="post-card-meta">
          <img
            src={displayAuthor.avatar}
            alt={displayAuthor.name}
            style={{ objectFit: "cover" }}
          />
          <div className="post-card-author">
            <h5>{displayAuthor.name}</h5>
            <span>{formatTimeAgoBangla(post.createdAt)}</span>
          </div>
        </NavLink>
        {showDeleteButton && (
          <button
            type="button"
            className="post-delete-btn"
            aria-label={TEXT_DELETE_POST_ARIA}
            onClick={() => {
              if (post.id) onDelete?.(post.id);
            }}>
            <DeleteOutlineIcon width={16} />
          </button>
        )}
      </header>

      {/* CONTENT */}
      {post.content && (
        <div className="post-content">
          <ExpandableText text={post.content} />
        </div>
      )}

      {/* MEDIA GALLERY */}
      {normalizedGallery.length > 0 && (
        <div
          className="post-media"
          style={{
            ...mediaContainerStyles,
            ...getGridConfig(displayItems.length),
          }}>
          {displayItems.map((item, index) => {
            const isOverflowItem = extraImageCount > 0 && index === 3;
            const itemStyle = getItemStyle(index, displayItems.length);
            const key = item.src ?? `media-${index}`;

            return (
              <div
                key={key}
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  if (post.id) onOpenPost?.(post.id, index);
                }}
                style={{
                  position: "relative",
                  width: "100%",
                  height: "100%",
                  gridRow: itemStyle.gridRow,
                  overflow: "hidden",
                  cursor: "pointer",
                  backgroundColor: "#000",
                }}>
                {item.type === "video" ? (
                  <video
                    ref={index === 0 ? videoRef : null}
                    src={item.src}
                    style={itemStyle}
                    muted
                    preload="metadata"
                  />
                ) : (
                  <img
                    src={item.src}
                    alt={TEXT_MEDIA_ALT}
                    style={itemStyle}
                  />
                )}
                {item.type === "video" && !isOverflowItem && (
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      width: "40px",
                      height: "40px",
                      backgroundColor: "rgba(0,0,0,0.6)",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      pointerEvents: "none",
                    }}>
                    ▶
                  </div>
                )}
                {isOverflowItem && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      backgroundColor: "rgba(0, 0, 0, 0.6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: "24px",
                      fontWeight: "bold",
                    }}>
                    +{extraImageCount}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ENGAGEMENT STATS */}
      <div className="post-engagement">
        <button
          type="button"
          onClick={() => {
            if (post.id) onOpenLikes?.(post.id);
          }}>{`${post.likes} ${TEXT_LIKE_COUNT_SUFFIX}`}</button>
        <button
          type="button"
          onClick={() => {
            if (post.id) onOpenComments?.(post.id);
          }}>{`${post.comments.length} ${TEXT_COMMENT_COUNT_SUFFIX}`}</button>
      </div>

      {/* ACTION BUTTONS (LIKE/COMMENT) - Fixed Z-Index */}
      <div
        className="post-actions"
        style={{ position: "relative", zIndex: 10 }}>
        <button
          type="button"
          className={post.liked ? "liked" : ""}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (post.id) onLike?.(post.id);
          }}
          style={{ cursor: "pointer" }}>
          {post.liked ? TEXT_LIKED : TEXT_LIKE}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (post.id) onOpenComments?.(post.id);
          }}
          style={{ cursor: "pointer" }}>
          {TEXT_COMMENTS}
        </button>
      </div>

      {/* --- COMMENT FORM HIDDEN --- */}
      {/* <div className="comment-form" style={{ position: "relative", zIndex: 10 }}>
        <textarea name="comment" value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder={TEXT_COMMENT_PLACEHOLDER} />
        <button type="button" onClick={submitComment}>{TEXT_COMMENT}</button>
      </div> 
      */}
    </article>
  );
}

PostCard.propTypes = {
  post: PropTypes.any,
  isOwner: PropTypes.bool,
  onLike: PropTypes.func,
  onOpenLikes: PropTypes.func,
  onOpenComments: PropTypes.func,
  onDelete: PropTypes.func,
  // onAddComment: PropTypes.func,
  onOpenPost: PropTypes.func,
};
