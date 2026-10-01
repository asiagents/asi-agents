type Props = {
  message: string;
};

export function Toast({ message }: Props) {
  return (
    <div className={`toast ${message ? "show" : ""}`} role="status">
      {message}
    </div>
  );
}
