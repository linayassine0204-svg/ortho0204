import { redirect } from "next/navigation";

// /patients/[id] ouvre directement la Fiche.
export default async function DossierPage({ params }: PageProps<"/patients/[id]">) {
  const { id } = await params;
  redirect(`/patients/${encodeURIComponent(id)}/fiche`);
}
