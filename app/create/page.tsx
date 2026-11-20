import Link from "next/link";
import { CreateForm } from "@/components/CreateForm";

export const metadata = { title: "Start a new coin" };

export default function CreatePage() {
  return (
    <div className="wrap" style={{ maxWidth: 1000 }}>
      <div style={{ padding: "8px 0 16px" }}>
        <Link href="/" className="bl">
          go back
        </Link>
      </div>
      <CreateForm />
    </div>
  );
}
