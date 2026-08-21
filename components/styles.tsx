type ButtonProps = {
  type: string;
  children: any;
};

export const XButton = ({ type, children }: ButtonProps) => {
  return (
    <button
      className={`${type === "primary" && "bg-yellow-400 hover:bg-yellow-500"} text-black  font-semibold text-xs rounded-full px-4 py-2 duration-500 transition`}
    >
      {children}
    </button>
  );
};
