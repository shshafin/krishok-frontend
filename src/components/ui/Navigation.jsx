import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { fetchNotifications } from "@/api/authApi"; // তুমি যেই path এ রাখছো সেই অনুযায়ী adjust করো
import bookIcon from "@/assets/icons/Book.svg";
import homeIcon from "@/assets/icons/Home.svg";
import imageIcon from "@/assets/icons/Image.svg";
import followersIcon from "@/assets/icons/Followers.svg";
import notificationIcon from "@/assets/icons/Notification.svg";
import CloseIcon from "@/assets/IconComponents/Close";

const iconStyle = { width: 20, height: 20 };

function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const popoverRef = useRef(null);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const res = await fetchNotifications();
        setNotifications(res.notifications);
      } catch (err) {
        console.error("Failed to fetch notifications:", err);
      }
    };
    loadNotifications();
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event) => {
      if (!popoverRef.current) return;
      if (!popoverRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  const handleDismiss = (id) => {
    setNotifications((prev) => prev.filter((notif) => notif.id !== id));
  };

  const handleClearAll = () => setNotifications([]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <nav
      className="NavigationLinks"
      style={{ display: "flex", gap: "16px", alignItems: "center" }}>
      <NavLink to="/">
        <img
          src={homeIcon}
          alt="Home"
          style={iconStyle}
        />
      </NavLink>

      <NavLink to="/gallery">
        <img
          src={imageIcon}
          alt="Gallery"
          style={iconStyle}
        />
      </NavLink>

      <NavLink to="/guidelines">
        <img
          src={bookIcon}
          alt="Library"
          style={iconStyle}
        />
      </NavLink>

      <section
        className="nav-notification"
        ref={popoverRef}>
        <button
          type="button"
          className={`nav-icon-button ${isOpen ? "is-open" : ""}`}
          onClick={() => setIsOpen((prev) => !prev)}
          aria-haspopup="true"
          aria-expanded={isOpen}
          aria-label="Open notifications">
          <img
            src={notificationIcon}
            alt="Notifications"
            style={iconStyle}
          />
          {unreadCount > 0 && <span className="nav-badge">{unreadCount}</span>}
        </button>

        {isOpen && (
          <aside className="notification-popover">
            <header className="notification-popover__header">
              <div>
                <span className="notification-popover__title">বিজ্ঞপ্তি</span>
                <p className="notification-popover__subtitle">
                  আপনার সাম্প্রতিক কার্যকলাপ সম্পর্কে দ্রুত আপডেট
                </p>
              </div>
              <button
                type="button"
                className="notification-clear"
                onClick={handleClearAll}
                disabled={!unreadCount}>
                Clear
              </button>
            </header>

            <div
              className="notification-popover__list"
              role="list">
              {notifications.length > 0 ? (
                notifications.map((notification) => (
                  <article
                    className="notification-item"
                    key={notification.id}
                    role="listitem">
                    <div className="notification-avatar-wrapper">
                      <img
                        src={notification.sender?.profileImage || ""}
                        alt={notification.sender?.username || "User"}
                        className="notification-avatar"
                      />
                    </div>
                    <div className="notification-body">
                      <span className="notification-author">
                        {notification.sender?.username || "Someone"}
                      </span>
                      <p className="notification-message">
                        {notification.message}
                      </p>
                      <time className="notification-time">
                        {new Date(notification.createdAt).toLocaleString()}
                      </time>
                    </div>
                    <button
                      type="button"
                      className="notification-dismiss"
                      aria-label="Dismiss notification"
                      onClick={() => handleDismiss(notification.id)}>
                      <CloseIcon
                        width={14}
                        height={14}
                      />
                    </button>
                  </article>
                ))
              ) : (
                <div className="notification-empty">
                  <p>সব কিছু আপডেটেড! নতুন কোনো নোটিফিকেশন নেই।</p>
                </div>
              )}
            </div>
          </aside>
        )}
      </section>

      <NavLink to="/me">
        <img
          src={followersIcon}
          alt="My profile"
          style={iconStyle}
        />
      </NavLink>
    </nav>
  );
}

export default Navigation;
