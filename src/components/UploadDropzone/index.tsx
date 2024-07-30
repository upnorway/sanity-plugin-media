import {white} from '@sanity/color'
import {Flex, Text, Button, Dialog} from '@sanity/ui'
import React, {ReactNode, useRef, useState} from 'react'
import {DropEvent, useDropzone} from 'react-dropzone'
import {useDispatch} from 'react-redux'
import styled, { createGlobalStyle } from 'styled-components'
import {useAssetSourceActions} from '../../contexts/AssetSourceDispatchContext'
import {DropzoneDispatchProvider} from '../../contexts/DropzoneDispatchContext'
import useTypedSelector from '../../hooks/useTypedSelector'
import {notificationsActions} from '../../modules/notifications'
import {uploadsActions} from '../../modules/uploads'
import ReactCrop, {Crop} from 'react-image-crop'
import {CropIcon} from '@sanity/icons'

type Props = {
  children: ReactNode
}

const GlobalStyle = createGlobalStyle`
  @keyframes marching-ants {
    0% {background-position: 0 0, 0 100%, 0 0, 100% 0;}
    to {background-position: 20px 0, -20px 100%, 0 -20px, 100% 20px;}
  }
  :root {
    --rc-drag-handle-size: 12px;
    --rc-drag-handle-mobile-size: 24px;
    --rc-drag-handle-bg-colour: rgba(0, 0, 0, .2);
    --rc-drag-bar-size: 6px;
    --rc-border-color: rgba(255, 255, 255, .7);
    --rc-focus-color: #0088ff;
  }
`;

const ReactCropStyle = styled.div`
  position: relative;
  display: inline-block;
  cursor: crosshair;
  max-width: 100%;

  *:before,
  *:after,
  * {
    box-sizing: border-box;
  }

  &--disabled,
  &--locked {
    cursor: inherit;
  }

  &__child-wrapper {
    overflow: hidden;
    max-height: inherit;

    > img,
    > video {
      display: block;
      max-width: 100%;
      max-height: inherit;
    }
  }

  &:not(&--disabled) &__child-wrapper > img,
  &:not(&--disabled) &__child-wrapper > video {
    touch-action: none;
  }

  &:not(&--disabled) &__crop-selection {
    touch-action: none;
  }

  &__crop-mask {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    pointer-events: none;
  }

  &__crop-selection {
    position: absolute;
    top: 0;
    left: 0;
    transform: translateZ(0);
    cursor: move;

    &:not(.ReactCrop--no-animate &__crop-selection) {
      animation: marching-ants 1s;
      background-image: linear-gradient(to right, #fff 50%, #444 50%),
        linear-gradient(to right, #fff 50%, #444 50%),
        linear-gradient(to bottom, #fff 50%, #444 50%),
        linear-gradient(to bottom, #fff 50%, #444 50%);
      background-size: 10px 1px, 10px 1px, 1px 10px, 1px 10px;
      background-position: 0 0, 0 100%, 0 0, 100% 0;
      background-repeat: repeat-x, repeat-x, repeat-y, repeat-y;
      color: #fff;
      animation-play-state: running;
      animation-timing-function: linear;
      animation-iteration-count: infinite;
    }

    &:focus {
      outline: 2px solid var(--rc-focus-color);
      outline-offset: -1px;
    }

    &--circular-crop {
      border-radius: 50%;

      &:after {
        pointer-events: none;
        content: "";
        position: absolute;
        top: -1px;
        right: -1px;
        bottom: -1px;
        left: -1px;
        border: 1px solid var(--rc-border-color);
        opacity: .3;
      }
    }

    &--invisible-crop {
      & .ReactCrop__crop-mask,
      & .ReactCrop__crop-selection {
        display: none;
      }
    }
  }

  &__rule-of-thirds-vt:before,
  &__rule-of-thirds-vt:after,
  &__rule-of-thirds-hz:before,
  &__rule-of-thirds-hz:after {
    content: "";
    display: block;
    position: absolute;
    background-color: #fff6;
  }

  &__rule-of-thirds-vt:before,
  &__rule-of-thirds-vt:after {
    width: 1px;
    height: 100%;
  }

  &__rule-of-thirds-vt:before {
    left: 33.3333333333%;
  }

  &__rule-of-thirds-vt:after {
    left: 66.6666666667%;
  }

  &__rule-of-thirds-hz:before,
  &__rule-of-thirds-hz:after {
    width: 100%;
    height: 1px;
  }

  &__rule-of-thirds-hz:before {
    top: 33.3333333333%;
  }

  &__rule-of-thirds-hz:after {
    top: 66.6666666667%;
  }

  &__drag-handle {
    position: absolute;
    width: var(--rc-drag-handle-size);
    height: var(--rc-drag-handle-size);
    background-color: var(--rc-drag-handle-bg-colour);
    border: 1px solid var(--rc-border-color);

    &:focus {
      background: var(--rc-focus-color);
    }
  }

  .ord-nw {
    top: 0;
    left: 0;
    transform: translate(-50%, -50%);
    cursor: nw-resize;
  }

  .ord-n {
    top: 0;
    left: 50%;
    transform: translate(-50%, -50%);
    cursor: n-resize;
  }

  .ord-ne {
    top: 0;
    right: 0;
    transform: translate(50%, -50%);
    cursor: ne-resize;
  }

  .ord-e {
    top: 50%;
    right: 0;
    transform: translate(50%, -50%);
    cursor: e-resize;
  }

  .ord-se {
    bottom: 0;
    right: 0;
    transform: translate(50%, 50%);
    cursor: se-resize;
  }

  .ord-s {
    bottom: 0;
    left: 50%;
    transform: translate(-50%, 50%);
    cursor: s-resize;
  }

  .ord-sw {
    bottom: 0;
    left: 0;
    transform: translate(-50%, 50%);
    cursor: sw-resize;
  }

  .ord-w {
    top: 50%;
    left: 0;
    transform: translate(-50%, -50%);
    cursor: w-resize;
  }

  .ReactCrop__disabled &__drag-handle {
    cursor: inherit;
  }

  &__drag-bar {
    position: absolute;
  }

  &__drag-bar.ord-n {
    top: 0;
    left: 0;
    width: 100%;
    height: var(--rc-drag-bar-size);
    transform: translateY(-50%);
  }

  &__drag-bar.ord-e {
    right: 0;
    top: 0;
    width: var(--rc-drag-bar-size);
    height: 100%;
    transform: translate(50%);
  }

  &__drag-bar.ord-s {
    bottom: 0;
    left: 0;
    width: 100%;
    height: var(--rc-drag-bar-size);
    transform: translateY(50%);
  }

  &__drag-bar.ord-w {
    top: 0;
    left: 0;
    width: var(--rc-drag-bar-size);
    height: 100%;
    transform: translate(-50%);
  }

  &--new-crop &__drag-bar,
  &--new-crop &__drag-handle,
  &--fixed-aspect &__drag-bar,
  &--fixed-aspect &__drag-handle.ord-n,
  &--fixed-aspect &__drag-handle.ord-e,
  &--fixed-aspect &__drag-handle.ord-s,
  &--fixed-aspect &__drag-handle.ord-w {
    display: none;
  }

  @media (pointer: coarse) {
    .ord-n,
    .ord-e,
    .ord-s,
    .ord-w {
      display: none;
    }

    .ReactCrop__drag-handle {
      width: var(--rc-drag-handle-mobile-size);
      height: var(--rc-drag-handle-mobile-size);
    }
  }
`;

const UploadContainer = styled.div`
  color: white;
  height: 100%;
  min-height: 100%;
  right: 0;
  top: 0;
  width: 100%;

  &:focus {
    outline: none;
  }
`

const DragActiveContainer = styled.div`
  align-items: center;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  height: 100%;
  justify-content: center;
  position: absolute;
  right: 0;
  top: 0;
  width: 100%;
  z-index: 3;
`

// Iterate through all files and only return non-folders / packages.
// We check for files by reading the first byte of the file
async function filterFiles(fileList: FileList) {
  const files = Array.from(fileList)

  const filteredFiles: File[] = []

  for (const file of files) {
    try {
      await file.slice(0, 1).arrayBuffer()
      filteredFiles.push(file)
    } catch (err) {
      // do nothing: file is a package or folder
    }
  }

  return filteredFiles
}

const UploadDropzone = (props: Props) => {
  const {children} = props

  const {onSelect} = useAssetSourceActions()

  // Redux
  const dispatch = useDispatch()
  const assetTypes = useTypedSelector(state => state.assets.assetTypes)

  const isImageAssetType = assetTypes.length === 1 && assetTypes[0] === 'image'

    // Callbacks

  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [croppedImage, setCroppedImage] = useState<File | null>(null)
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const imageRef = useRef<HTMLImageElement | null>(null);

  const handleDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0]
      if (file.type.startsWith('image/')) {
        setOriginalFile(file)
        const reader = new FileReader()
        reader.onload = () => setSelectedImage(reader.result as string)
        reader.readAsDataURL(file)
      } else {
        dispatch(
          uploadsActions.uploadRequest({
            file,
            forceAsAssetType: assetTypes.length === 1 ? assetTypes[0] : undefined
          })
        )
      }
    }
  }
  // Use custom file selector to obtain files on file drop + change events (excluding folders and packages)
  const handleFileGetter = async (event: DropEvent) => {
    let fileList: FileList | undefined
    if (event.type === 'drop' && 'dataTransfer' in event) {
      fileList = event?.dataTransfer?.files
    }
    if (event.type === 'change') {
      const target = event?.target as HTMLInputElement
      if (target?.files) {
        fileList = target.files
      }
    }

    if (!fileList) {
      return []
    }

        // Filter out non-folders / packages
    const files: File[] = await filterFiles(fileList)
    
    // Dispatch error if some files have been filtered out
    if (fileList?.length !== files.length) {
      dispatch(
        notificationsActions.add({
          status: 'error',
          title: `Unable to upload some items (folders and packages aren't supported)`
        })
      )
    }

    return files
  }

   // Limit file picking to only images if we're specifically within an image selection context (e.g. picking from image fields)
  const {getRootProps, getInputProps, isDragActive, open} = useDropzone({
    accept: isImageAssetType ? 'image/*' : '',
    getFilesFromEvent: handleFileGetter,
    noClick: true,
    // HACK: Disable drag and drop functionality when in a selecting context
    // (This is currently due to Sanity's native image input taking precedence with drag and drop)
    noDrag: !!onSelect,
    onDrop: handleDrop
  })

  const getCroppedImg = (image: HTMLImageElement, crop: Crop, fileName: string): Promise<File> => {
    const canvas = document.createElement('canvas')
    const scaleX = image.naturalWidth / imageDimensions.width
    const scaleY = image.naturalHeight / imageDimensions.height
    canvas.width = crop.width * scaleX
    canvas.height = crop.height * scaleY
    const ctx = canvas.getContext('2d')

    ctx?.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width * scaleX,
      crop.height * scaleY
    )

    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error('Canvas is empty'))
          return
        }
        resolve(new File([blob], fileName, { type: blob.type }))
      }, originalFile?.type || 'image/jpeg')
    })
  }

  const handleCropComplete = async (crop: Crop) => {
    if (selectedImage && originalFile) {
      const image = new Image()
      image.src = selectedImage
      const croppedFile = await getCroppedImg(image, crop, originalFile.name)
      setCroppedImage(croppedFile)
    }
  }

  const handleUpload = () => {
    if (crop && croppedImage) {
      dispatch(
        uploadsActions.uploadRequest({
          file: croppedImage,
          forceAsAssetType: assetTypes.length === 1 ? assetTypes[0] : undefined
        })
      );
    } else if (originalFile) {
      dispatch(
        uploadsActions.uploadRequest({
          file: originalFile,
          forceAsAssetType: assetTypes.length === 1 ? assetTypes[0] : undefined
        })
      );
    }
    setSelectedImage(null);
    setCroppedImage(null);
    setOriginalFile(null);
    setCrop(undefined);
  };

  return (
    <>
      <GlobalStyle />
      <DropzoneDispatchProvider open={open}>
        <UploadContainer {...getRootProps()}>
          <input {...getInputProps()} />

          {isDragActive && (
            <DragActiveContainer>
              <Flex direction="column" justify="center" style={{ color: white.hex }}>
                <Text size={3} style={{ color: 'inherit' }}>
                  Drop files to upload
                </Text>
              </Flex>
            </DragActiveContainer>
          )}
          {selectedImage && (
            <Dialog
              id="dialog-crop"
              header="Crop Image"
              width={1}
              onClose={() => setSelectedImage(null)}
            >
              <ReactCropStyle>
                <div style={{ textAlign: 'center', overflow: 'hidden' }}>
                  <ReactCrop
                    crop={crop}
                    onChange={newCrop => setCrop(newCrop)}
                    onComplete={handleCropComplete}
                    style={{ maxWidth: '100%' }}
                  >
                    <img
                      ref={imageRef}
                      src={selectedImage}
                      style={{ maxWidth: '100%' }}
                      onLoad={() => {
                        if (imageRef.current) {
                          setImageDimensions({
                            width: imageRef.current.width,
                            height: imageRef.current.height,
                          });
                        }
                      }}
                    />
                  </ReactCrop>
                  <div style={{ marginTop: '10px', marginBottom: '10px' }}>
                    <Button
                      fontSize={1}
                      icon={CropIcon}
                      onClick={handleUpload}
                      tone="caution"
                      text="Crop & Upload"
                      style={{ display: 'inline-block' }}
                    />
                  </div>
                </div>
              </ReactCropStyle>
            </Dialog>
          )}
          {children}
        </UploadContainer>
      </DropzoneDispatchProvider>
    </>
  );
}

export default UploadDropzone
