import { useNavigate } from "react-router-dom";

import type { GameShop, LibraryGame, SeedingStatus } from "@types";

import { Badge, Button } from "@renderer/components";
import {
  buildGameDetailsPath,
  formatDownloadProgress,
} from "@renderer/helpers";

import { Downloader, formatBytes, steamUrlBuilder } from "@shared";
import { DOWNLOADER_NAME } from "@renderer/constants";
import { useAppSelector, useDownload } from "@renderer/hooks";

import * as styles from "./download-group.css";
import { useTranslation } from "react-i18next";
import { SPACING_UNIT, vars } from "@renderer/theme.css";
import { useMemo } from "react";
import {
  DropdownMenu,
  DropdownMenuItem,
} from "@renderer/components/dropdown-menu/dropdown-menu";
import {
  ColumnsIcon,
  DownloadIcon,
  LinkIcon,
  PlayIcon,
  ThreeBarsIcon,
  TrashIcon,
  UnlinkIcon,
  XCircleIcon,
} from "@primer/octicons-react";

export interface DownloadGroupProps {
  library: LibraryGame[];
  title: string;
  openDeleteGameModal: (shop: GameShop, objectId: string) => void;
  openGameInstaller: (shop: GameShop, objectId: string) => void;
  seedingStatus: SeedingStatus[];
}

export function DownloadGroup({
  library,
  title,
  openDeleteGameModal,
  openGameInstaller,
  seedingStatus,
}: DownloadGroupProps) {
  const navigate = useNavigate();

  const { t } = useTranslation("downloads");

  const userPreferences = useAppSelector(
    (state) => state.userPreferences.value
  );

  const {
    lastPacket,
    progress,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    isGameDeleting,
    pauseSeeding,
    resumeSeeding,
  } = useDownload();

  const getFinalDownloadSize = (game: LibraryGame) => {
    const download = game.download!;
    const isGameDownloading = lastPacket?.gameId === game.id;

    if (download.fileSize) return formatBytes(download.fileSize);

    if (lastPacket?.download.fileSize && isGameDownloading)
      return formatBytes(lastPacket.download.fileSize);

    return "N/A";
  };

  const seedingMap = useMemo(() => {
    const map = new Map<string, SeedingStatus>();

    seedingStatus.forEach((seed) => {
      map.set(seed.gameId, seed);
    });

    return map;
  }, [seedingStatus]);

  const getGameInfo = (game: LibraryGame) => {
    const download = game.download!;

    const isGameDownloading = lastPacket?.gameId === game.id;
    const finalDownloadSize = getFinalDownloadSize(game);
    const seedingStatus = seedingMap.get(game.id);

    if (isGameDeleting(game.id)) {
      return <p>{t("deleting")}</p>;
    }

    if (isGameDownloading) {
      if (lastPacket?.isDownloadingMetadata) {
        return <p>{t("downloading_metadata")}</p>;
      }

      if (lastPacket?.isCheckingFiles) {
        return (
          <>
            <p>{progress}</p>
            <p>{t("checking_files")}</p>
          </>
        );
      }

      return (
        <>
          <p>{progress}</p>

          <p>
            {formatBytes(lastPacket.download.bytesDownloaded)} /{" "}
            {finalDownloadSize}
          </p>

          {download.downloader === Downloader.Torrent && (
            <small>
              {lastPacket?.numPeers} peers / {lastPacket?.numSeeds} seeds
            </small>
          )}
        </>
      );
    }

    if (download.progress === 1) {
      const uploadSpeed = formatBytes(seedingStatus?.uploadSpeed ?? 0);

      return download.status === "seeding" &&
        download.downloader === Downloader.Torrent ? (
        <>
          <p>{t("seeding")}</p>
          {uploadSpeed && <p>{uploadSpeed}/s</p>}
        </>
      ) : (
        <p>{t("completed")}</p>
      );
    }

    if (download.status === "paused") {
      return (
        <>
          <p>{formatDownloadProgress(download.progress)}</p>
          <p>{t(download.queued ? "queued" : "paused")}</p>
        </>
      );
    }

    if (download.status === "active") {
      return (
        <>
          <p>{formatDownloadProgress(download.progress)}</p>

          <p>
            {formatBytes(download.bytesDownloaded)} / {finalDownloadSize}
          </p>
        </>
      );
    }

    return <p>{t(download.status as string)}</p>;
  };

  const getGameActions = (game: LibraryGame): DropdownMenuItem[] => {
    const download = lastPacket?.download;
    const isGameDownloading = lastPacket?.gameId === game.id;

    const deleting = isGameDeleting(game.id);

    if (download?.progress === 1) {
      return [
        {
          label: t("install"),
          disabled: deleting,
          onClick: () => openGameInstaller(game.shop, game.objectId),
          icon: <DownloadIcon />,
        },
        {
          label: t("stop_seeding"),
          disabled: deleting,
          icon: <UnlinkIcon />,
          show:
            download.status === "seeding" &&
            download.downloader === Downloader.Torrent,
          onClick: () => pauseSeeding(game.shop, game.objectId),
        },
        {
          label: t("resume_seeding"),
          disabled: deleting,
          icon: <LinkIcon />,
          show:
            download.status !== "seeding" &&
            download.downloader === Downloader.Torrent,
          onClick: () => resumeSeeding(game.shop, game.objectId),
        },
        {
          label: t("delete"),
          disabled: deleting,
          icon: <TrashIcon />,
          onClick: () => openDeleteGameModal(game.shop, game.objectId),
        },
      ];
    }

    if (isGameDownloading || download?.status === "active") {
      return [
        {
          label: t("pause"),
          onClick: () => pauseDownload(game.shop, game.objectId),
          icon: <ColumnsIcon />,
        },
        {
          label: t("cancel"),
          onClick: () => cancelDownload(game.shop, game.objectId),
          icon: <XCircleIcon />,
        },
      ];
    }

    return [
      {
        label: t("resume"),
        disabled:
          download?.downloader === Downloader.RealDebrid &&
          !userPreferences?.realDebridApiToken,
        onClick: () => resumeDownload(game.shop, game.objectId),
        icon: <PlayIcon />,
      },
      {
        label: t("cancel"),
        onClick: () => cancelDownload(game.shop, game.objectId),
        icon: <XCircleIcon />,
      },
    ];
  };

  if (!library.length) return null;

  return (
    <div className={styles.downloadGroup}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: `${SPACING_UNIT * 2}px`,
        }}
      >
        <h2>{title}</h2>

        <div
          style={{
            flex: 1,
            backgroundColor: vars.color.border,
            height: "1px",
          }}
        />
        <h3 style={{ fontWeight: "400" }}>{library.length}</h3>
      </div>

      <ul className={styles.downloads}>
        {library.map((game) => {
          return (
            <li
              key={game.id}
              className={styles.download}
              style={{ position: "relative" }}
            >
              <div className={styles.downloadCover}>
                <div className={styles.downloadCoverBackdrop}>
                  <img
                    src={steamUrlBuilder.library(game.objectId)}
                    className={styles.downloadCoverImage}
                    alt={game.title}
                  />

                  <div className={styles.downloadCoverContent}>
                    <Badge>
                      {
                        DOWNLOADER_NAME[
                          game?.download?.downloader as Downloader
                        ]
                      }
                    </Badge>
                  </div>
                </div>
              </div>
              <div className={styles.downloadRightContent}>
                <div className={styles.downloadDetails}>
                  <div className={styles.downloadTitleWrapper}>
                    <button
                      type="button"
                      className={styles.downloadTitle}
                      onClick={() =>
                        navigate(
                          buildGameDetailsPath({
                            ...game,
                            objectId: game.objectId,
                          })
                        )
                      }
                    >
                      {game.title}
                    </button>
                  </div>

                  {getGameInfo(game)}
                </div>

                {getGameActions(game) !== null && (
                  <DropdownMenu
                    align="end"
                    items={getGameActions(game)}
                    sideOffset={-75}
                  >
                    <Button
                      style={{
                        position: "absolute",
                        top: "12px",
                        right: "12px",
                        borderRadius: "50%",
                        border: "none",
                        padding: "8px",
                        minHeight: "unset",
                      }}
                      theme="outline"
                    >
                      <ThreeBarsIcon />
                    </Button>
                  </DropdownMenu>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
