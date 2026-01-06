import { useState } from "react";
import ExpandableText from "@/components/ui/ExpandableText";
import { useLocation } from "react-router-dom";
import { NavLink } from "react-router-dom";
import PropTypes from "prop-types";
import { format } from "timeago.js";
import DeleteOutlineIcon from "@/assets/IconComponents/DeleteOutlineIcon";
import { useVideoVisibility } from "@/hooks/useVideoVisibility";

const mediaStyles = {
  width: "100%",
  display: "block",
  objectFit: "cover",
};

const TEXT_LIKED =
  "\u09B2\u09BE\u0987\u0995 \u0995\u09B0\u09BE \u09B9\u09DF\u09C7\u099B\u09C7";
const TEXT_LIKE = "\u09B2\u09BE\u0987\u0995";
const TEXT_COMMENTS = "\u09AE\u09A8\u09CD\u09A4\u09AC\u09CD\u09AF";
const TEXT_COMMENT = "\u09AE\u09A8\u09CD\u09A4\u09AC\u09CD\u09AF";
const TEXT_COMMENT_PLACEHOLDER =
  "\u09AE\u09A8\u09CD\u09A4\u09AC\u09CD\u09AF \u0995\u09B0\u09C1\u09A8...";
const TEXT_DELETE_POST_ARIA =
  "\u09AA\u09CB\u09B8\u09CD\u099F \u09AE\u09C1\u099B\u09C7 \u09AB\u09C7\u09B2\u09C1\u09A8";
const TEXT_MEDIA_ALT =
  "\u09AA\u09CB\u09B8\u09CD\u099F\u09C7\u09B0 \u099B\u09AC\u09BF";
const TEXT_LIKE_COUNT_SUFFIX = "\u09B2\u09BE\u0987\u0995";
const TEXT_COMMENT_COUNT_SUFFIX = "\u09AE\u09A8\u09CD\u09A4\u09AC\u09CD\u09AF";

export default function PostCard({
  post,
  isOwner,
  onLike,
  onOpenLikes,
  onOpenComments,
  onDelete,
  onAddComment,
  onOpenPost,
}) {
  const [commentText, setCommentText] = useState("");
  const location = useLocation();

  // Video visibility hook for viewport-based play/pause with global coordination
  const videoRef = useVideoVisibility({ threshold: 0.3, priority: 'normal' });

  // Show delete button only when on the user's profile page (/me)
  const showDeleteButton = Boolean(
    isOwner && location?.pathname?.startsWith("/me")
  );

  const submitComment = () => {
    const value = commentText.trim();
    if (!value) return;
    onAddComment?.(post.id, value);
    setCommentText("");
  };

  const media = post.media;
  const mediaGallery = Array.isArray(post.mediaGallery)
    ? post.mediaGallery.filter(
      (item) => item && item.type === "image" && item.src
    )
    : [];
  const canShowGallery = media?.type !== "video";
  const galleryImages = canShowGallery
    ? mediaGallery.length
      ? mediaGallery
      : media?.type === "image"
        ? [media]
        : []
    : [];
  const totalGalleryImages = galleryImages.length;
  const extraImageCount = totalGalleryImages > 4 ? totalGalleryImages - 4 : 0;
  const visibleGallery = extraImageCount
    ? galleryImages.slice(0, 4)
    : galleryImages;
  const handleOpenPost = () => {
    onOpenPost?.(post.id);
  };
  const handleOpenPostAt = (index) => {
    onOpenPost?.(post.id, index);
  };
  const handleMediaKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleOpenPost();
    }
  };
  const mediaInteractableProps = onOpenPost
    ? {
      role: "button",
      tabIndex: 0,
      onClick: handleOpenPost,
      onKeyDown: handleMediaKeyDown,
    }
    : {};

  return (
    <article className="post-card">
      <header className="post-card-header">
        <NavLink
          to={
            post.author?._id
              ? `/user/${post.author._id}`
              : `/user/${post.author.id ?? post.author._id ?? ""}`
          }
          className="post-card-meta">
          <img
            src={post.author.avatar}
            alt={post.author.name}
          />
          <div className="post-card-author">
            <h5>{post.author.name}</h5>
            <span>{format(post.createdAt)}</span>
          </div>
        </NavLink>
        {showDeleteButton && (
          <button
            type="button"
            className="post-delete-btn"
            aria-label={TEXT_DELETE_POST_ARIA}
            onClick={() => onDelete?.(post.id)}>
            <DeleteOutlineIcon width={16} />
          </button>
        )}
      </header>

      {post.content && (
        <div className="post-content">
          <ExpandableText text={post.content} />
        </div>
      )}

      {media?.type === "video" && media?.src && (
        <div
          className="post-media"
          {...mediaInteractableProps}>
          <video
            ref={videoRef}
            src={media.src}
            controls
            muted
            loop
            style={mediaStyles}
          />
        </div>
      )}

      {visibleGallery.length > 0 && (
        <div
          className={`post-media post-media--has-gallery`}
          data-count={totalGalleryImages}
          {...mediaInteractableProps}>
          <div
            className={`post-media-grid count-${Math.min(
              visibleGallery.length,
              4
            )}`}>
            {visibleGallery.map((item, index) => {
              const isOverflowItem =
                extraImageCount > 0 && index === visibleGallery.length - 1;
              const key = item.src ?? `media-${index}`;
              return (
                <div
                  key={key}
                  className={`post-media-grid-item${isOverflowItem ? " post-media-grid-item--more" : ""
                    }`}>
                  <img
                    src={item.src}
                    alt={post.content || TEXT_MEDIA_ALT}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleOpenPostAt(index);
                    }}
                  />
                  {isOverflowItem && (
                    <span className="post-media-grid-more-label">
                      +{extraImageCount}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="post-engagement">
        <button
          type="button"
          onClick={() => onOpenLikes?.(post.id)}>
          {`${post.likes} ${TEXT_LIKE_COUNT_SUFFIX}`}
        </button>
        <button
          type="button"
          onClick={() => onOpenComments?.(post.id)}>
          {`${post.comments.length} ${TEXT_COMMENT_COUNT_SUFFIX}`}
        </button>
      </div>

      <div className="post-actions">
        <button
          type="button"
          className={post.liked ? "liked" : ""}
          onClick={() => onLike?.(post.id)}>
          {post.liked ? TEXT_LIKED : TEXT_LIKE}
        </button>
        <button
          type="button"
          onClick={() => onOpenComments?.(post.id)}>
          {TEXT_COMMENTS}
        </button>
      </div>

      <div className="comment-form">
        <textarea
          name="comment"
          value={commentText}
          onChange={(event) => setCommentText(event.target.value)}
          placeholder={TEXT_COMMENT_PLACEHOLDER}
        />
        <button
          type="button"
          onClick={submitComment}>
          {TEXT_COMMENT}
        </button>
      </div>
    </article>
  );
}

PostCard.propTypes = {
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
    mediaGallery: PropTypes.arrayOf(
      PropTypes.shape({
        type: PropTypes.oneOf(["image"]),
        src: PropTypes.string,
      })
    ),
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
    author: PropTypes.shape({
      name: PropTypes.string.isRequired,
      avatar: PropTypes.string.isRequired,
    }).isRequired,
    comments: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
          .isRequired,
      })
    ),
  }).isRequired,
  isOwner: PropTypes.bool,
  onLike: PropTypes.func,
  onOpenLikes: PropTypes.func,
  onOpenComments: PropTypes.func,
  onDelete: PropTypes.func,
  onAddComment: PropTypes.func,
  onOpenPost: PropTypes.func,
};

PostCard.defaultProps = {
  isOwner: false,
  onLike: undefined,
  onOpenLikes: undefined,
  onOpenComments: undefined,
  onDelete: undefined,
  onAddComment: undefined,
  onOpenPost: undefined,
};
