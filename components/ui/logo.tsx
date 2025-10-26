import Image from 'next/image';

export default function Logo() {
  return (
    <div className="flex items-center p-2">
      <Image
        src="/logo.png"
        alt="Flusor Logo"
        width={48}
        height={48}
        className="rounded-lg object-contain"
      />
    </div>
  );
}
