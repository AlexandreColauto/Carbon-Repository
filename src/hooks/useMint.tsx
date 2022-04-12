import { useMoralis } from "react-moralis";
import s3 from "../components/s3";
import NFT from "../../artifacts/contracts/NFT.sol/NFT.json";

type uploadFile = (e: File) => Promise<string>;
interface props {
  name: string;
  description?: string;
  imgUrl?: string | null;
  callback: () => void;
  address: string;
  collectionName: string;
}
type create = (props: props) => Promise<boolean | undefined>;
function useCreateCollection(): [uploadFile, create] {
  const { isAuthenticated, Moralis, authenticate } = useMoralis();

  const mint: create = async (props) => {
    const ethers = Moralis.web3Library;

    const { name, description, imgUrl, callback, address, collectionName } =
      props;
    if (!name || !imgUrl) {
      alert("Fill the required Information before minting.");
      return false;
    }
    if (!isAuthenticated) authenticate();

    const currentId = {
      contractAddress: address,
      functionName: "currentId",
      abi: NFT.abi,
    };
    const [_tokenId, _fee] = (await Moralis.executeFunction(currentId)) as any;

    let tokenId = parseInt(_tokenId.toString(), 10) + 1;
    let fee = parseInt(_fee.toString(), 10);

    const mint = {
      contractAddress: address,
      functionName: "mint",
      abi: NFT.abi,
      params: {
        reciever: Moralis.account,
      },
    };
    try {
      const tokenHash: any = await Moralis.executeFunction(mint);

      if (tokenHash) {
        const s3Bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME;
        if (!s3Bucket) {
          throw new Error("bucket missing, chech your config file");
        }
        const objectType = "application/json"; // type of file
        const data = JSON.stringify({ name, description, image: imgUrl, fee });
        const tokenIdString = tokenId.toString().padStart(64, "0");
        // setup params for putObject
        const params = {
          Bucket: s3Bucket,
          ACL: "public-read",
          Key: collectionName + "/" + tokenIdString + ".json",
          Body: data,
        };
        const result = s3.putObject(params, (err) => {
          console.log(err);
        });
      }
      await tokenHash.wait();
      callback();
      return true;
    } catch (err) {
      console.log(err);
      return false;
    }
  };

  const saveFile: uploadFile = async (e) => {
    const data = e;
    const file = new Moralis.File(data.name, data);
    await file.saveIPFS();
    return file._url;
  };

  return [saveFile, mint];
}
export default useCreateCollection;
