import PropTypes from "prop-types";
import Modal from "./Modal";

export default function AllPostsModal({ open, onClose, posts, onSelect }) {
  return (
    <Modal open={open} onClose={onClose} title="সবগুলো পোস্ট" size="lg">
      {posts?.length ? (
        <div className="all-posts-grid">
          {posts.map((post, idx) => (
            <button
              type="button"
              className="all-posts-item"
              key={`${post.id ?? 'p'}-${idx}`}
              onClick={() => onSelect?.(post)}
            >
              {post.media?.type === "video" ? (
                <video src={post.media?.src} />
              ) : (
                <img src={post.media?.src} alt={post.content || "পোস্টের ছবি"} />
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-state">এখনো কোনো পোস্ট নেই</div>
      )}
    </Modal>
  );
}

AllPostsModal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  posts: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      media: PropTypes.shape({
        type: PropTypes.oneOf(["image", "video"]),
        src: PropTypes.string,
      }),
      content: PropTypes.string,
    })
  ),
  onSelect: PropTypes.func,
};

AllPostsModal.defaultProps = {
  open: false,
  onClose: undefined,
  posts: [],
  onSelect: undefined,
};
