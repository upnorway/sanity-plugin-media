import {white} from '@sanity/color'
import {Flex, Text, Button, Dialog} from '@sanity/ui'
import React, {ReactNode, useEffect, useRef, useState} from 'react'
import {DropEvent, useDropzone} from 'react-dropzone'
import {useDispatch} from 'react-redux'
import styled from 'styled-components'
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

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/react-image-crop/dist/ReactCrop.css';
    document.head.appendChild(link);
  }, []);
  
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
    <DropzoneDispatchProvider open={open}>
      <UploadContainer {...getRootProps()}>
        <input {...getInputProps()} />

        {isDragActive && (
          <DragActiveContainer>
            <Flex direction="column" justify="center" style={{color: white.hex}}>
              <Text size={3} style={{color: 'inherit'}}>
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
          </Dialog>
        )}
        {children}
      </UploadContainer>
    </DropzoneDispatchProvider>
  )
}

export default UploadDropzone
