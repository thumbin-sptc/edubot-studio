import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreateWizard } from "@/components/create/create-wizard";
import { devices, isDevice, isPlatform, platforms } from "@/lib/create/model";
import { getCreateEntries } from "@/lib/create/published";

type Props = { params: Promise<{ platform: string; device: string }> };
export const dynamicParams = false;

export function generateStaticParams() {
  return getCreateEntries().flatMap(({ platform, device, support }) => support === "supported" ? [{ platform, device }] : []);
}

async function findGuide(params: Props["params"]) {
  const { platform, device } = await params;
  if (!isPlatform(platform) || !isDevice(device)) notFound();
  const entries = getCreateEntries();
  const guide = entries.find((entry) => entry.support === "supported" && entry.platform === platform && entry.device === device);
  if (!guide || guide.support !== "supported") notFound();
  const desktopAvailable = entries.some((entry) => entry.support === "supported" &&
    entry.platform === guide.platform && entry.device === "desktop-web");
  return { guide, desktopAvailable };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { guide } = await findGuide(params);
  return { title: `${platforms[guide.platform]} ${devices[guide.device]} 에듀봇 제작 안내` };
}

export default async function CreateGuidePage({ params }: Props) {
  const { guide, desktopAvailable } = await findGuide(params);
  return <CreateWizard guide={guide} desktopAvailable={desktopAvailable} />;
}
