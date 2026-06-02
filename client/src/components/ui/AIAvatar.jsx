const AIAvatar = ({ size = 24 }) => (
  <div
    style={{ width: size, height: size }}
    className="flex items-center justify-center flex-shrink-0"
  >
    <div
      className="bg-volt"
      style={{
        width: size * 0.42,
        height: size * 0.42,
        clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
        animation: "diamondPulse 3s ease infinite",
      }}
    />
  </div>
);

export default AIAvatar;
