import Image from 'next/image';

export default function Logo() {
  return (
    <div className="flex items-center">
      <Image
        src="/logo.png"
        alt="Flusor Logo"
        width={32}
        height={32}
        className="rounded-lg"
      />
    </div>
  );
}
